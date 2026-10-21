// WebRTC Budworth Mere Camera viewer 
//import { WHEPClient } from "./whep.js";
import { WebRTCWhep } from "./webrtcwhep.js";

const version="1.0 SPotts"
const loadingPoster = "bsc/loading.png";
const timeoutPoster = "bsc/timeout.png";
const testCard = "bsc/bsctestcard.jpg";
// Timeout 10 Minutes
const timeout= 3;
// Number of missed intervals before the stream is considered unhealthy
const missedBeatThreshhold = 30;
//Cloudflare Live Input WHEP Url for this camera stream from Cloudflare Dashboard
const whepUrl = "https://customer-pg5y7mkamhnunvh2.cloudflarestream.com/2f69e60c1bbaf58b93ab6e1e5072c2f4/webRTC/play"
const token = "";

//Dom objects
console.log("playstream(): Attaching to DOM elements");
const banner = document.getElementById("banner");
const videoTag = document.getElementById("merewebcam");
//const healthBanner = document.getElementById("healthstate");
const healthyIcon = document.getElementById("healthyicon");
const unhealthyIcon = document.getElementById("unhealthyicon");
const streamRate = document.getElementById("streamrate");

//Global Objects
//Create tbe RTCPeerConnection which will handle the camera stream from Cloudflare
console.log("Creating global RTCPeerConnection and MediaStream objects");
const peerConnection = new RTCPeerConnection({ bundlePolicy: "max-bundle" });
//MediaStream will play the incoming streams
const stream = new MediaStream();
//Create a whep client from custom class WebRTCWhep and associate peerConnection to stream
const whep = new WebRTCWhep(peerConnection, stream);

//Event Handlers
videoTag.onresize = (event) => {
    console.log("video element is resizing ...");
};

// This event is fired when the stream goes unhealthy
whep.addEventListener("onunhealthy", async () => {
    console.log("Event onunhealthy : The stream has stalled - closing the stream connection.");
    setUnhealthyIcons(true);
    whep.stopMonitor(); // should be stopped but just in case
    whep.stop()
        .then(() => {
            console.warn("Event onunhealthy: Stream has been closed down");
            setTimeout(() => {
                console.log("() Clearing MediaStream and setting default poster");
                videoTag.poster = testCard;
                videoTag.srcObject = null
            }, 1000);
        })
});

// Update the tickertape Marquee
function updateBanner() {
    if (whep.pc) {
        switch (whep.pc.connectionState) {
            case "connecting":
                return "BudworthTV: Live stream is connecting. Please wait...";
            case "connected":
                return "BudworthTV: Live stream is connected. Wind today is etc etc";
            case "disconnected":
                return "The stream has disconnected. Trying to reconnect ...";
            case "failed":
                return "BudworthTV: is offline or unreachable. Please try later";
            case "closed":
                return "The stream is now closed or timed out. Refresh the page to reconnect";
            default:
                return "BudworthTV: Better than ITV for sure ...";
        }
    } else {
        return "BudworthTV: is not broadcasting at this time. Please try later"
    }
}

//update the health statistics
function updateHealthStatus(metrics) {
    // streamRate should be visible
    streamRate.hidden = false;
    streamRate.innerText = `${metrics.kBps}`;
    // Only show missed hearbeats
    setUnhealthyIcons(metrics.missedBeats > 0)
}

// set the health icons
function setUnhealthyIcons(unhealthy) {
    healthyIcon.hidden = unhealthy;
    unhealthyIcon.hidden = !unhealthy;
}


//begin here

// Marquee text and Video Tag poster attribute
videoTag.poster = testCard;
setUnhealthyIcons(true);
banner.innerText = updateBanner();
whep.view(whepUrl, token, videoTag)
    .then(() => {
        console.log("playstream: Launching Tickertape banner");
        const monitorTimer = setInterval(() => {
            banner.innerText = updateBanner();
        }, 1000);
    })  
    .then(() => {
        console.log(`playstream: Setting Stream timeout to ${timeout} minutes`);
        setTimeout(async () => {
            console.warn("timeout (): The viewing timeout has expired. Stream closing down");
            //banner.innerText="The connection has timed out - refresh the page to reconnect"
            await whep.stop();
            setUnhealthyIcons(true);
            videoTag.poster = testCard;
            videoTag.srcObject=null;
            //stats.stop();
        },timeout*60*1000);
    })
    .then(() => {
        // stream health monitor - watches for stalled streams
        whep.startMonitor((metrics) => {
            updateHealthStatus(metrics)
        },missedBeatThreshhold,1000)
        .then(console.log("playstream: health monitor is running"))
    })
    /*
    .then(() => {
        console.log("Starting healthcheck watchdog");
        setTimeout(async () => {
            await whep.startMonitor((metrics) => {
                healthBanner.innerText = `Stream Health: streamRate ${metrics.kBps}kBs :byteDelta ${metrics.bytesDelta} : missed beats ${metrics.missedBeats}`;
            });
        }, 1000);
    })
    */
    .catch((e) => {
        whep.stopMonitor();
        banner.innerText="The camera stream is currently unavailable - Please try later";
        setUnhealthyIcons(true);
        videoTag.poster = testCard;
        console.error(`Problem loading stream: ${e.message}`);
    });

console.log("PlayStream End of script - stream running");
