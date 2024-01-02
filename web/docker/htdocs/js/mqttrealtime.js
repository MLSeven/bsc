/*
MQTT Realtime client script for Budworth Sailing Club Weather Station.

Stephen Potts Sept 2020

Uses SteelSeries CumulusMX gauges object in dashboard mode directly updatimg the gauges from  mqtt subscription

*/

var mqttGauges;

mqttGauges = function () {
    'use strict';

    // Configurable Section
    var config = {
        version: "1.0.0",                       // Version
        host: "weatherlog.budworthsc.org.uk",   // Broker Hostname
        port: 9001,                             // Port
        topic: "CumulusMX/Realtime",            // mqtt Topic to subscribe to
        reconnectTimeout: 15,                   // time to wait before attempting to reconnect after a disconnect
        reconnectAttempts: 5,                   // Number of times reconnection is attempted
        pageTimeout: 600,                        // Page lifetime - connection closed after this period of time running
        msgTimeout: 20,                         // period of time to wait for a topic update from mqtt broker
        rag: {                                  // rag status Bootstrap css class names
            red: "text-danger",
            amber: "text-warning",
            green: "text-success"
        }
    };

    var dt;
    var mqtt;           // Paho Eclipse Client object
    var cumulusData;    // Serialised json returned from CumulusMX topic

    // This object holds the status of the mqtt client connection. rag is red, amber, green
    var status = {
        clientId: null,
        rag: undefined,
        connectTime: null,
        disconnectTime: null,
        lastMsgTime: null,
        reconnectCount: 0,
        pageTimeoutHandle: null,
        msgTimeoutHandle: null,
        reconnectTimeoutHandle: null
    }

    //Supporting functions Update the web page elements (id='ragicon' and id='statustext')

    // Update the rag icon (id 'ragicon') class to change its colour
    function updateRagStatus(rag) {
        if ($("#ragicon").length && rag !== status.rag) {
            // clear current rag before updating
            console.log("updateRagStatus: Current Class " + $("#ragicon").attr("class"));
            $("#ragicon").removeClass(status.rag);
            status.rag = rag
            // Update rag
            $("#ragicon").addClass(status.rag);
            console.log("updateRagStatus: New Class " + $("#ragicon").attr("class"));
        }
    }

    // jQuery Marquee Banner update function for displaying Status Messages and RAG status (Red,Amber, Green)
    function updateMarquee(statusMsg, ragStatus) {
        // update RAG icon if needed
        if (ragStatus) {
            updateRagStatus(ragStatus);
        }
        if ($("#statustext").length) {
            if ($("#statustext").html() !== statusMsg) {
                // statusMsg has changed  - do update
                console.log("updateMarquee: @ " + new Date().toLocaleString() + " " + statusMsg + " RAG " + ragStatus);
                $("#statustext").html(statusMsg);
                //console.log("updateMarquee: " + JSON.stringify(status));
            }
        }
    }

    // helper function to generate a status message from the Realtime Data returned from CumulusMX
    function getStatusMsg(rtData) {

        if (rtData) {
            var msg = "Update:  " + rtData.date;
            msg += " Highest Gust <small>(10min)</small> " + rtData.wgust + rtData.windunit;
            msg += " Dominant Wind <small>(24hrs)</small> " + rtData.domwinddir;
            return msg;
        }
        else {
            return "";
        }
    }

    // mqtt code and callback functions

    // Callback function called when connection is lost.
    function onConnectionLost(responseObject) {

        if (responseObject.errorCode > 0) {
            // Abnormal Disconnect
            status.disconnectTime = new Date().toLocaleString();
            console.log("onConnectionLost: Connection to Broker interruted " + responseObject.errorMessage + " @" + status.disconnectTime);
            //Cancel any outstanding page  or msg timeout to prevent any issues with reconnect
            if (status.pageTimeoutHandle) {
                console.log("onConnectionLost: Cancelling Page timeout. Handle " + status.pageTimeoutHandle);
                clearTimeout(status.pageTimeoutHandle);
                status.pageTimeoutHandle = null;
            }
            if (status.msgTimeoutHandle) {
                console.log("onConnectionLost: Cancelling msg timeout. Handle " + status.msgTimeoutHandle);
                clearTimeout(status.msgTimeoutHandle);
                status.msgTimeoutHandle = null;
            }
            // Setup a timer to try reconnecting
            console.log("onConnectionLost: Setting Timer to attempt Reconnect in " + config.reconnectTimeout + "s")
            status.reconnectTimeoutHandle = setTimeout(mqttClientConnect, config.reconnectTimeout * 1000);
            updateMarquee("Lost connection @ " + status.disconnectTime + " Attempting to reconnect in " + config.reconnectTimeout + "s", config.rag.red);
        }
        else {
            // Error code 0 is a normal disconnect so don't try to reconnect
            console.log("onConnectionLost: Client has normally disconnected from broker");
        }
    }

    // When a message arrives handle it with this function. 
    // Uses SteelSeries gauges object from the global Window object
    function onMessageArrived(msg) {

        if (msg.destinationName == config.topic) {
            // A message has arrived fromn broker cancel any live msgTimeouts
            if (status.msgTimeoutHandle) {
                //Cancel msg timeout
                clearTimeout(status.msgTimeoutHandle);
                // Set a new timeout for the next subscription
                status.msgTimeoutHandle = setTimeout(topicDown, config.msgTimeout * 1000);
            }

            try {
                cumulusData = JSON.parse(msg.payloadString);
            }
            catch (e) {
                cumulusData = null;
            }
            //get the timestamp out of the msg
            status.lastMsgTime = cumulusData.date;
            console.log("onMessageArrived: json msg arrived from topic " + msg.destinationName + " Updating Realtime Gauges ...");
            if (cumulusData) {
                updateMarquee(getStatusMsg(cumulusData), config.rag.green);
                //Update Steelseries gauges. Check object first
                if (gauges) {
                    gauges.processData(cumulusData);
                }
            }
        }
        else {
            console.log("onMessageArrived: Message discarded - not our topic");
        }
    }

    // Callback function when successfully subscribed to Topic    
    function onSubscribeSuccess() {
        console.log("onSubscribeSuccess: Successfully subscribed to " + config.topic);
        // Note that success here does not mean messages are being received !!
    }

    function onSubscribeFailure() {
        console.log("onSubscribeFailure: Failed to subscribe to topic " + config.topic);
        topicDown();
    }

    // Callback function fired on a successful connection to Broker
    function onClientConnected() {
        // save the connect time
        status.connectTime = new Date().toLocaleString();
        status.disconnectTime = null;
        // set a timeout if no message arrives from broker within the msgTimout assume station down - save handle
        status.msgTimeoutHandle = setTimeout(topicDown, config.msgTimeout * 1000);
        // set a page timeout to disconnect subscription after a set period. Save the handle
        status.pageTimeoutHandle = setTimeout(pageTimeout, config.pageTimeout * 1000);
        //reset the reconnect handle and counter
        status.reconnectCount = 0;
        status.reconnectTimeoutHandle = null;
        console.log("onClientConnected: Connected to Broker @ " + status.connectTime + " - Attempting to subscribe to " + config.topic);
        console.log("onClientConnected: msgTimeout " + config.msgTimeout + "s");
        console.log("onClientConnected: pageTimeout " + config.pageTimeout + "s");

        //Update Marquee banner
        updateMarquee("Connected: Waiting for Station update", config.rag.amber);

        // Setup callback options for topic subscription setup
        var subscribeOptions = {
            timeout: 10,
            onSuccess: onSubscribeSuccess,
            onFailure: onSubscribeFailure
        };
        try {
            mqtt.subscribe(config.topic, subscribeOptions);
        }
        catch (e) {
            console.log("onClientConnected: Exception Subscribing to topic " + e);
        }
    }

    // Callback function fired when client fails to connect to broker
    function onConnectionFailed(message) {

        //Cancel any outstatnding reconnect Timers
        if (status.reconnectTimeoutHandle) {
            console.log("onConnectionFailed: Clearing reconnectTimeoutHandle " + status.reconnectTimeoutHandle);
            clearTimeout(status.reconnectTimeoutHandle);
            status.reconnectTimeoutHandle = null;
        }

        console.log("onConnectionFailed: Failed to connect to Broker on Host " + config.host + " Error Code " + message.errorCode);
        status.reconnectCount++;
        if (status.reconnectCount < config.reconnectAttempts) {
            console.log("onConnectionFailed: Setting reconnection Timer for " + config.reconnectTimeout + "s Attempt # " + status.reconnectCount);
            status.reconnectTimeoutHandle = setTimeout(mqttClientConnect, config.reconnectTimeout * 1000);
            //update tge Marquee. Msg reflects if this is a re-connect
            if (status.disconnectTime) {
                // reconnect
                updateMarquee("Lost connection @ " + status.disconnectTime + ". Attempting to reconnect in " + config.reconnectTimeout + "s", config.rag.red);
            }
            else {
                updateMarquee("Failed to connect to Weather Station - retrying in " + config.reconnectTimeout + "s", config.rag.red);
            }
        }
        else {
            updateMarquee(status.reconnectCount + " failed connection attempts. Weather Station offline.", config.rag.red);
            // Stop Processing
        }
    }

    // Connect mqtt Client to the Broker service
    function mqttClientConnect() {

        console.log("mqttClientConnect: Setting up connecting to Broker");
        updateMarquee("Connecting to Weather Station ...", config.rag.red);
        // Cancel any existing pageTimeouts
        if (status.pageTimeoutHandle) {
            console.log("mqttClientConnect: Clearing pageTimeout " + status.pageTimeoutHandle);
            clearTimeout(status.pageTimeoutHandle);
            status.pageTimeoutHandle = null;
        }

        if (mqtt) {
            // Setup Callback functions
            mqtt.onMessageArrived = onMessageArrived;
            mqtt.onConnectionLost = onConnectionLost;
            // setup the options and callbacks for Success and Failed client connections
            var options = {
                useSSL: true,
                timeout: 3,
                onSuccess: onClientConnected,
                onFailure: onConnectionFailed
            };
            // connect to Broker
            try {
                mqtt.connect(options);
                console.log("mqttClientConnect: Connection initiated");
            }
            catch (e) {
                console.log("mqttClientConnect: Exception initiating connection " + e);
            }
        }
        else {
            console.log("mqttClientConnect: No mqtt client object found");
        }
    }

    // page Timeout has fired.
    function pageTimeout() {

        console.log("pageTimeout: The Page Timeout period has expired");
        status.pageTimeoutHandle = null;
        //cancel any msgTimeouts
        if (status.msgTimeoutHandle) {
            clearTimeout(status.msgTimeoutHandle);
            status.msgTimeoutHandle = null;
        }
        updateMarquee("Page timeout reached. Refresh the page to reconnect Weather Station", config.rag.red);
        try {
            mqtt.disconnect();
            console.log("pageTimeout: Disconnecting mqtt Client");
        }
        catch (e) {

        }
    }

    // No updates are being received on the subscription topic but the broker is connected. 
    // This suggests CumulusMX is down. Keep waiting on the subscription until the page times out
    function topicDown() {

        console.log("topicDown: No message updates received for topic " + config.topic + " within msgTimeout Period " + config.msgTimeout + "s");
        status.msgTimeoutHandle = setTimeout(topicDown, config.msgTimeout * 1000);
        console.log("topicDown: Reseting msgTimeout with handle " + status.msgTimeoutHandle);
        if (status.lastMsgTime) {
            updateMarquee("Weather Station is not sending updates. Last Update @" + status.lastMsgTime + ". Waiting ...", config.rag.amber);
        }
        else {
            updateMarquee("Weather Station is not sending updates. Waiting ...", config.rag.amber);
        }
    }

    // start processing here

    console.log("mqttGauges: Starting Script");
    if (window.gauges) {
        console.log("mqttGauges: Found Steelseries gauges object " + gauges.config.scriptVer + "Dashboard Mode: " + gauges.config.dashboardMode);
        try {
            dt = new Date(); // current time
            status.clientId = "mqtt" + dt.getTime();
            console.log("mqttGauges: Attempting to create mqtt Client object for clientId " + status.clientId);
            mqtt = new Paho.MQTT.Client(config.host, config.port, status.clientId);
        }
        catch (e) {
            console.log("mqttGauges: No mqtt client object class found");
            mqtt = null;
        }

        if (mqtt) {
            console.log("mqttGauges: Initiating mqtt Client connection");
            mqttClientConnect();
        }
    }
    else {
        console.log("mqttGauges: Warning: No Steelseries Gauges object loaded");
    }
    updateMarquee(null);
    console.log("mqttGuages: Script complete.");
}

$(document).ready(function () {
    console.log("Document ready Starting Script... ");
    setTimeout(mqttGauges(), 1000);
});
