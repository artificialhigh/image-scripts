var fs = require('fs');
var Clarifai = require('clarifai');
var repl = require('repl');

var inputFiles = [];
var currImgIndex = 0;
 
var clarifaiResults = [];
var currFilePath = "";

Clarifai.initialize({
  'clientId': 'h2INmpq2GKjYlr7kcwus_EKTK3Q5_I8vBwOTJwTY',
  'clientSecret': 'p2i9cgUjXse1ok-H6bcisiAM_0aKv5FfcZFzAaxJ'
});

var walk = function(dir, done) {
  var files = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var i = 0;
    (function next() {
      var file = list[i++];
      if (!file) return done(null, files);
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            files = files.concat(res);
            next();
          });
        } else {
          files.push(file);
          next();
        }
      });
    })();
  });
};

function saveResponses() {
    fs.writeFileSync(
        'C:\\clarifai_results.txt', 
        JSON.stringify(clarifaiResults, null, 4),
        function(err) {
            if(err) {
                return console.log(err);
            }
        }
    );
};

walk("C:\\Users\\apalaniuk\\Desktop\\final-images", function(err, files) {
  if (err) throw err;

  for(var i = 0; i < files.length; i++) {
      if(files[i].indexOf('MobileBanner_767x490@1x.jpg') !== -1) {
        inputFiles.push(files[i]);
      }
  }

  getTags();
});

function getTags() {
    fs.readFile(inputFiles[currImgIndex], function(err, data) {
            var base64data = new Buffer(data).toString('base64');
            
            console.log("Uploading " + inputFiles[currImgIndex]);

            Clarifai.getTagsByImageBytes(
                base64data,
                {language: 'en'}
            ).then(
                handleResponse,
                handleError);
        });
}

function handleResponse(response){
    console.log('promise response: ', JSON.stringify(response, null, 4));

    if(response.status_code !== "OK") {
        saveResponses();
        return;
    }

    clarifaiResults.push({
        file: inputFiles[currImgIndex],
        response: response
    });

    saveResponses();

    // Handle synchronously so we can avoid throttling limits
    if (++currImgIndex < inputFiles.length) {
        setTimeout(getTags, 1000);
    } else {
        //console.log('** FINAL RESULTS **');
        //console.log(JSON.stringify(clarifaiResults, null, 4));
        saveResponses();
        console.log("Complete! I hope.");
    }
};

function handleError(err){
  console.log('promise error: ', err);
  saveResponses();
};