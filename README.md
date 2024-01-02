# bsc
BSC CumulusMX web 

Contains the BSC modifications for the CulmulusMX Weather Station data logging Software.

The BSC Wind web has 2 components

## CumulusMX installation on Raspberry Pi

The data logging is performed at the club by a Raspberry Pi with the CumulusMX package installed. The R-Pi also has a Docker MQTT container which handles the requests for the weather guage updates from web clients

## Website

An externally hosted website where sailors can visit to see the realtime wind gauges and data tables. Static conttnt is updated every 15 minutes from the Raspberry Pi and gaugue data is updated real-time via MQTT javascript objects 

