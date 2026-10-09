// WebRTC Budworth Mere Camera viewer 
import { WHEPClient } from "./whep.js"
const version="1.0 SPotts"
const loadingPoster = "bsc/loading.png";
const timeoutPoster = "bsc/timeout.png";
//Timeout 10 Minutes
const timeout= 10*16*1000;

//Create tbe RTCPeerConnection which will handle the camera stream from Cloudflare
const pc = new RTCPeerConnection({ bundlePolicy: "max-bundle" });


//Add Receive only transceivers
console.log("Adding rtcReceivers to the RTCPeerConnection")
pc.addTransceiver("audio",{ direction: "recvonly" });
pc.addTransceiver("video", { direction: "recvonly" });

// Create MediaStream and add the tracks as they arrive
console.log("Creating MediaStream");
const stream = new MediaStream();
// videoTag HTML <Video> Element
console.log("Attaching MediaStream to VIDEO Tag srcObject");
const videoTag = document.getElementById("merewebcam");
videoTag.srcObject = stream;
videoTag.poster = loadingPoster;
console.log("Set up Event handlers for the media streams");
//Setup Event Handler for the incoming stream and attach to the MediaStream
pc.ontrack = (event) =>
{
    console.log("Adding incoming " + event.track.kind + " track to the media stream");
    stream.addTrack(event.track);
}

//Setup Event Handler for Video Tag resize
videoTag.onresize = (event) => {
    console.log("video element is resizing ...");
};

console.log("Prepare to connect to the Media Stream source");
//Create a whep client viewer 
const whep = new WHEPClient();

//Cloudflare Live Input WHEP Url for this camera stream from Cloudflare Dashboard
const whepUrl = "https://customer-pg5y7mkamhnunvh2.cloudflarestream.com/2f69e60c1bbaf58b93ab6e1e5072c2f4/webRTC/play"
const token = "";

//Start viewing pass in the peerConnection and Cloudflare Live Input WHEP Stream url
whep.view(pc, whepUrl, token);

setTimeout(() => {
    console.log("Viewing Timeout has expired. Close down the stream")
    whep.stop(); 
    //Remove the Mediastream
    videoTag.poster = timeoutPoster;
    videoTag.srcObject=null;
    },timeout);
