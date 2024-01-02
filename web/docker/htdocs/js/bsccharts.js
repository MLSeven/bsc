/*
RGRAPH charting script for Budworth Sailing Club Weather Station.
Stephen Potts Nov 2020
Uses RGRAPH Clientside js library for Charting
*/

const TENMIN = 600000; // milliseconds

var dochart;

dochart = function () {

    // helper Function. Sample the datapoint as the required interval (should be multiples of 10 mins)
    function sampleData(dataObj, interval) {

        var timeStamp = [], data = [], labels=[], i = 0;
        var nextSampleTimestamp = dataObj[0][0];

        console.log("dataObj has " + dataObj.length + " elements. Interval (ms) " + interval);
        console.log("First timestamp is " + dataObj[0][0] + " is " + new Date(dataObj[0][0]));
        console.log("Last timestamp is " + dataObj[dataObj.length - 1][0] + " is " + new Date(dataObj[dataObj.length - 1][0]));

        for (i = 0; i < dataObj.length; i++) {
            if (dataObj[i][0] >= nextSampleTimestamp) {
                //capture this time and value
                timeStamp.push(dataObj[i][0]);
                labels.push(new Date(dataObj[i][0]).toLocaleTimeString());
                data.push(dataObj[i][1]);
                nextSampleTimestamp = dataObj[i][0] + interval;
                console.log("Using Datapoint " + i + " Time " + dataObj[i][1] + " value: " + dataObj[i][1] + " is " + new Date(dataObj[i][0]));
            }
        }
        console.log("Max "+ Math.max.apply(Math,data));
        console.log("Min "+ Math.min.apply(Math,data));

        return {
            timeStamp: timeStamp,
            data: data,
            labels: labels,
            interval: interval,
            maxValue: Math.max.apply(null,data),
            minValue: Math.min.apply(null,data)
        };
    }

    function plotPressure(json) {
        console.log("Starting plotPressure");
        var graphData = sampleData(json.press, 60 * 60000);
        console.log("datapoints : " + graphData.timeStamp.length + " sample interval " + graphData.interval);

        var line = new RGraph.Bar({
            id: 'cvs',
            data: graphData.data,
            options: {
                xaxisTitle: "Time",
                filled: false,
                colors: ["blue"],
                xaxisLabels: graphData.labels,
                xaxisLabelsSize: 8,
                linewidth: 0.001,
                filledAccumulative: false,
                marginInner: 10,
                linewidth: 1,
                marginLeft: 35,
                yaxisScaleMin: graphData.minValue-10,
                yaxisScaleMax: graphData.maxValue+5                
            }
        }).draw();
        console.log(line.scale2);

    }

    function plotWind(json) {
        console.log("Starting plotwind");
        var graphData = sampleData(json.wgust, 10 * 60000);
        console.log("datapoints : " + graphData.timeStamp.length + " sample interval " + graphData.interval);

        var line = new RGraph.Line({
            id: 'cvs',
            data: graphData.data,
            options: {
                xaxisTitle: "Time",
                filled: false,
                colors: ["blue"],
                spline: false,
                xaxisLabels: graphData.labels,
                xaxisLabelsSize: 8,
                linewidth: 0.001,
                filledAccumulative: false,
                marginInner: 10,
                linewidth: 1,
                marginLeft: 35,
                yaxisScaleMin: graphData.minValue,
                yaxisScaleMax: graphData.maxValue+5                
            }
        }).draw();
        console.log(line.scale2);

    }

    // start here 

    //new RGraph.AJAX.getJSON({ url: 'pressdata.json', callback: plotPressure });
    new RGraph.AJAX.getJSON({ url: 'winddata.json', callback: plotWind });

}

$(document).ready(function () {
    console.log("Document ready Starting Script... ");
    //new RGraph.AJAX.getJSON({ url: 'pressdata.json', callback: getData});
    setTimeout(dochart(), 1000);
});


/*
new RGraph.AJAX.getJSON({ url: 'pressdata.json', callback: drawGraph });

//Make an array of labels from a dataset
//Dataset is an array of 2 element arays ie dataSet[i][0]=TimeStamp , dataSet[i][1] = Data
function makeLabels(dataSet) {
    var t = dataSet[0][0]; // Starting timestamp

    do {
        time = new Date(t);
        xLabels.push(time.getHours() + ":" + time.getMinutes());
        t = t + (60 * 60 * 1000);
        console.log(time.getHours() + ":" + time.getMinutes());
    } while (t < json.press[json.press.length - 1][0]);
}


function drawGraph1(json) {

    //var xaxis = ["03/10 20:50","21:50","22:50","23:50","00:50","01:50","02:50"];
    var data = [[], []];
    var xLabels = [];
    var startTime = new Date(json.wspeed[0][0]).toLocaleString();
    var t = json.wspeed[0][0]; // Start timestamp
    // xAxis labels create one for every hour starting from first reading
    do {
        time = new Date(t);
        xLabels.push(time.getHours() + ":" + time.getMinutes());
        t = t + (60 * 60 * 1000);
        console.log(time.getHours() + ":" + time.getMinutes());
    } while (t < json.wspeed[json.wspeed.length - 1][0]);

    //console.log(json);
    json.wgust.forEach(element => {
        data[0].push(element[1]);
    });
    json.wspeed.forEach(element => {
        data[1].push(element[1]);
    });
    console.log("Data " + data[0].length + " " + data[1].length);
    // Now draw the chart
    var line = new RGraph.Line({
        id: 'cvs',
        data: data,
        options: {
            xaxisTitle: "Time",
            filled: false,
            colors: ["red", "blue"],
            xaxisLabels: xLabels,
            xaxisLabelsSize: 8,
            linewidth: 0.001,
            filledAccumulative: false,
            marginInner: 10,
            linewidth: 1,
            marginLeft: 35
        }
    }).draw();

}

*/