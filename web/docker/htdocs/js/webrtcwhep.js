/* global navigator */
/* global window */
/* global RTCPeerConnection */
/* global EventSource */

export class WebRTCWhep extends EventTarget
{
    constructor(peerConnection,stream) {
        console.log("WebRTCWhep(): - Running Constructor");
        super();
        //peerConnection stream MUST be supplied and created by the calling script
        if (peerConnection) {
            this.pc = peerConnection;
        } else {
            throw new Error("WebRTCWhep(): You must supply a peerConnection of type RTCPeerConnection");
        }
        if (stream) {
            this.stream = stream;
        } else {
            throw new Error("WebRTCWhep(): You must supply a stream of type MediaStream");
        }
        //Store the WHEPUrl and Token and location once the connection is established
        this.whepUrl = "";
        this.token = "";
        this.resourceUrl = "";
        // Stream Health properties
        this.monitorTimer = null;
        this.healthy = true;
        this.missedBeatsThreshold = 20;
        this.prevStats = null;
        //Ice properties ??
        this.iceUsername = null;
        this.icePassword = null;
        // time to handle iceConnectionState
        this.disconnectedIceTimer
        this.disconnectedIceTimeout = 8000;

        //Setup Event Handler for the incoming stream and attach to the MediaStream
        console.log("Set up Event handlers for the media streams");
        this.pc.ontrack = (event) => {
            console.log(`Event onTrack Adding incoming ${event.track.kind} track to the media stream`);
            this.stream.addTrack(event.track);
        };
            
        this.pc.onicegatheringstatechange = (event) => {
            console.log("Event iceGatheringStateChange " + event.target.iceGatheringState);
        };

        // handle changes in the iceConnection state
        this.pc.oniceconnectionstatechange = async (event) => {
            console.warn("Event iceConnectionState " + this.pc.iceConnectionState);
            switch (this.pc.iceConnectionState) {
                case "new":
                case "checking":
                    break;
                case "failed":
                    // iceConnection failed - connectionState will also fail
                    // maybe set a timer to stop the stream??     await this.stop();
                    break;
                case "disconnected":
                    // restart after a delay to cater for poor connections
                    this.disconnectedIceTimer = setTimeout(async () => {
                        await this.restartIce()
                    }, this.disconnectedIceTimeout);
                    break;
                case "connected":
                case "completed":
                    if (this.disconnectedIceTimer) clearTimeout(this.disconnectedIceTimer);
                    if (this.failedIceTimer) clearTimeout(this.failedIceTimer);
                    break;
                default:
            }
        };

        this.pc.onsignalingstatechange = (event) => {
            console.log("Event signalingState "+ this.pc.signalingState);
        };

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Event iceCandidate " + event.candidate.candidate)
            } else {
                console.log("Event iceCandidate - No More Candidates")
            }
        };

        this.pc.onconnectionstatechange = async (event) =>
        {
            console.log("Event connectionState " + this.pc.connectionState);
            if (this.pc.connectionState === "failed") {
                console.error("Stream has " + this.pc.connectionState);
                await this.stop();
            }
        };

        //setup the peerConnection adding Receive only transceivers for the audio and video tracks
        console.log("WebRTCWhep(): Adding rtcReceivers to the peerConnection")
        this.pc.addTransceiver("audio",{ direction: "recvonly" });
        this.pc.addTransceiver("video", { direction: "recvonly" });
        console.log("WebRTCWhep(): constructor done");
    }

    // Negoitiate iceConnection - any errors are passed up the promise chain
    async negotiate(whepUrl,token=null) {
        //Create SDP offer
        console.log("negotiate: Creating the Offer SPD");
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        console.log("negotiate(): Exchange SDP whepUrl: " + whepUrl);
        //Request headers
        const requestHeaders = new Headers();
        requestHeaders.append("Content-Type","application/sdp");
        //If token is set
        if (token) {
            requestHeaders.append("Authorization","Bearer " + token);
        }
        console.log("negotiate(): POST sdp to whepUrl");
        const response = await fetch(whepUrl, {
            method: "POST",
            headers: requestHeaders,
            body: offer.sdp
        });
        switch (response.status) {
            case 409:
                throw new Error(`negotiate(): WHEP broadcast is not currently enabled. Status ${response.status}`);
                break;
            case 201:
                console.log("negotiate(): WHEP endpoint successfully created");
                if (!response.headers.get("location"))
                    throw new Error("negotiate(): WHEP endpoint failed to return a location Url for the stream");
                break;
            default:
                throw new Error(`negotiate(): Unexpected status code POSTing to WHEP url - ${response.status}`);
        }
        //status 201: Stream looks good - update the class properties
        this.whepUrl = whepUrl;
        this.token = token;
        this.resourceUrl = new URL(response.headers.get("location"), whepUrl);
        // get answer SPD and set this on the RTCPeerConnection
        const answerSdp = await response.text();
        await this.pc.setRemoteDescription(new RTCSessionDescription({
            type: "answer",
            sdp: answerSdp
        }));
        console.log("negotiate(): finished iceConnection negotiation");
        return this.resourceUrl;
    }    

    // View the webRtc stream via the WHEP url. Supply a bearer token if needed
    // any errors are passed up the promise chain
    async view(whepUrl, token, videoTag) {
        console.log("view(): Starting WHEP Stream viewer ");
        this.resourceUrl = await this.negotiate(whepUrl, token);
        videoTag.srcObject = this.stream;
        console.log("view(): negotiate completed - stream should be running");
    }

    // run the callback function specified in parameter callback every healthInterval
    // use metrics gathered from the stream statistics to decide if the stream is healthy
    async startMonitor(callback, threshold=30, healthInterval=1000) {
        console.log(`startMonitor(): Starting monitor with interval ${healthInterval}`);
        console.log(`startMonitor(): The threshold for missed heartbeats intervals is ${threshold}`);
        // seed the value prevStats
        this.missedBeatsThrehold = threshold;
        this.prevStats = await this.pc.getStats();
        // start the monitorHealthcheck callback via an interval Timer saving the id
        this.monitorTimer = setInterval(async () => {
            if (!this.healthy) {
                console.log("health watchdog (): The video stream has stalled - signalling unhealthy");
                this.dispatchEvent(new Event("onunhealthy"));
                //Cancel the intervalTimer
                this.stopMonitor();
                return
            }
            try {
                const currStats = await this.pc.getStats();
                const metrics = this._heartbeat(currStats);
                this.prevStats = currStats;
                if (callback) callback(metrics);
                //console.dir(metrics);
                this.healthy = (metrics.missedBeats < this.missedBeatsThreshold);
            } catch (e) {
                console.error(`monitorhealthCheck: Error reading stream statistics ${e.message}`);
            }
        }, healthInterval);
    }

    // Clear monitor - monitor event onunhealth which is fired when the stream stalls
    stopMonitor() {
        if (this.monitorTimer) {
            console.log(`stopMonitor(): clearing interval timer connection healthcheck`);
            clearInterval(this.monitorTimer);
            this.monitorTimer = null;
        }
    }

    // attempt to restart the connection 
    async restartIce() {
        const whepUrl = this.whepUrl;
        const token = this.token;
        if (!this.pc) {
            console.error("RTCPeerConnection is already closed");
            return;
        }
        if (this.disconnectedIceTimer) clearTimeout(this.disconnectedIceTimer);
        console.warn("restartIce(): attempting to restart the connection");
        this.pc.restartIce();
        this.negotiate(whepUrl,token)
            .then(() => {
                console.log("restartIce(): negotiate completed");
            })
            .catch((e) => {
                console.error(`restartIce(): ${e.message}`);
            });
    }

    async mute(muted)
    {
        //Request headers
        const headers = {
            "Content-Type": "application/json"
        };

        //If token is set
        if (this.token)
            headers["Authorization"] = "Bearer " + this.token;

        //Do the post request to the whep resource
        const fetched = await fetch(this.resourceURL, {
            method  : "POST",
            body    : JSON.stringify(muted),
            headers
        });
    }

    // The connection has failed: try to gracefully close the stream 
    async stop() {
        if (this.pc.connectionState === "closed") return //already closed
        if (!this.resourceUrl) throw new Error("stop(): the stream resourceUrl is unavailable");
        //Try and close the WHEP stream gracefully
        const requestHeaders = new Headers();
        // add the token if one was used to negotiate the WHEP stream
        if (this.token) {
            requestHeaders.append("Authorization","Bearer " + this.token);
        }
        console.log("stop(): Stopping WHEP stream - sending DELETE to stream resource Url");
        try {
            const response = await fetch(this.resourceUrl, {
                method: "DELETE",
                headers: requestHeaders
            });
            if (response.status !== 200) {
                console.error(`DELETE Method on WHEP Url returned status ${response.status}`);
                throw new Error("DELETE Method on WHEP url failed");
            }
        } catch (e) {
            console.error(`stop(): Fetch error ${e.message} - forcing close() on peerConnection`);
        } finally {
            // signal connection is unhealthy
            this.healthy = false;
            console.log(`stop(): connectionState ${this.pc.connectionState}`);
            this.pc.close();
            console.log(`stop(): connectionState ${this.pc.connectionState}`);
        }
    }

    // Helper function to extract metrics from the MediaStreamTrack
    _heartbeat(currentStats) {
        const metrics = {
            bytesReceived: 0,
            kBps: 0,
            timestamp: null,
            bytesDelta: 0,
            timeDelta: 0,
            missedBeats: 0
        };
        try {
            currentStats.forEach((report) => {
                const prevReport = this.prevStats.get(report.id);
                if (prevReport && report.type === "inbound-rtp" && report.kind === "video") {
                    const byteDelta = report.bytesReceived - prevReport.bytesReceived;
                    const timeDelta = (report.timestamp - prevReport.timestamp)/1000;
                    ((byteDelta == 0) && (timeDelta>= 0)) ? this.missedBeats += 1 : this.missedBeats = 0;
                    metrics.bytesReceived = report.bytesReceived || 0;
                    metrics.timestamp = report.timestamp;
                    metrics.bytesDelta =  byteDelta >= 0 ? byteDelta : 0;
                    metrics.timeDelta =  timeDelta >= 0 ? timeDelta : 0;
                    metrics.kBps = (timeDelta > 0) ? Math.round(((byteDelta)/timeDelta)/1024) : 0;
                    metrics.missedBeats = this.missedBeats;
                }
            });
        } catch (e) {
            console.warn("_heartbeat(): Report not available returning empty metrics");
        }
        return metrics;
    }

}