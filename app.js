'use strict';

var Clarifai = require('clarifai');
const repl = require('repl');
const path = require('path');
const fs = require('fs-extra');
const fsreaddirrecursive = require('fs-readdir-recursive');
const recursivereaddir = require('recursive-readdir');
const shortcutUrl = require('shortcut-url');
const weblocParser = require('webloc-parser');
const uuid = require('aguid');

var inputFiles = [];
var currImgIndex = 0;
 
var clarifaiResults = {};
var currFilePath = "";

Clarifai.initialize({
  'clientId': 'h2INmpq2GKjYlr7kcwus_EKTK3Q5_I8vBwOTJwTY',
  'clientSecret': 'p2i9cgUjXse1ok-H6bcisiAM_0aKv5FfcZFzAaxJ'
});

const replServer = repl.start({
    prompt: '> ',
    eval: myEval
});

function convertToMap(outfile) {
    var convertedResults = {};

    for(var i = 0; i < clarifaiResults.length; i++) {
        convertedResults[clarifaiResults[i].file] = clarifaiResults[i].response;
    }

    fs.writeFileSync(
        outfile, 
        JSON.stringify(convertedResults, null, 4)
    );
};

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
        'C:\\clarifai_results_v2.txt', 
        JSON.stringify(clarifaiResults, null, 4)
    );
};

function main(inDir) {
    walk(inDir, function(err, files) {
        if (err) {
            saveResponses();
            throw err;
        }

        for(var i = 0; i < files.length; i++) {
            if(files[i].indexOf('banner-narrow-low-density-max-size.jpg') !== -1) {
                if (!clarifaiResults.hasOwnProperty(files[i])) {
                    inputFiles.push(files[i]);
                } else {
                    console.log(files[i] + ' already tagged. Skipping.');
                }
            }
        }

        console.log(inputFiles.length + ' files will be tagged.');
        console.log(files);
        getTags(inDir);
    });
}

function getTags(inDir) {
    fs.readFile(inputFiles[currImgIndex], function(err, data) {
            var base64data = new Buffer(data).toString('base64');
            
            console.log("Uploading " + inputFiles[currImgIndex]);
            console.log(path.parse(inputFiles[currImgIndex]).dir.replace(inDir, ''));

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
        console.log('Error: ' + response.status_code);
        saveResponses();
        return;
    }

    clarifaiResults[inputFiles[currImgIndex]] = response;

    // Handle synchronously so we can avoid throttling limits
    if (++currImgIndex < inputFiles.length) {
        setTimeout(getTags, 500);
    } else {
        saveResponses();
        console.log("Complete! I hope.");
    }
};

function handleError(err){
  console.log('promise error: ', err);
  saveResponses();
};

function prepare() {
    var i = 0;
    var database = [];
    var sizePrototypes = [
            {
                width: 540,
                height: 230,
                type: 'tile',
                size: 'max'
            },
            {
                width: 220,
                height: 95,
                type: 'tile',
                size: 'mid'
            },
            {
                width: 145,
                height: 60,
                type: 'tile',
                size: 'min'
            },
            {
                width: 1200,
                height: 300,
                type: 'banner-wide',
                size: 'max'
            },
            {
                width: 960,
                height: 240,
                type: 'banner-wide',
                size: 'mid'
            },
            {
                width: 768,
                height: 192,
                type: 'banner-wide',
                size: 'min'
            },
            {
                width: 767,
                height: 490,
                type: 'banner-narrow',
                size: 'max'
            },
            {
                width: 375,
                height: 240,
                type: 'banner-narrow',
                size: 'mid'
            },
            {
                width: 320,
                height: 205,
                type: 'banner-narrow',
                size: 'min'
            }
        ];

    for(var property in clarifaiResults) {
        let origPath = path.join('C:/users/apalaniuk/desktop/final-images/', path.normalize(property));
        fs.copySync(origPath, 'C:\\users\\apalaniuk\\desktop\\course-image-catalog\\images\\' + clarifaiResults[property].id);
        let fileName = path.parse(path.normalize(property)).name.toLowerCase();

        let sizes = [];

        for(var currSize = 0; currSize < sizePrototypes.length; currSize++) {
            let currSizePrototype = sizePrototypes[currSize];
            let lowDensityFileName = currSizePrototype.type + '-low-density-' + currSizePrototype.size + '-size.jpg';
            let highDensityFileName = currSizePrototype.type + '-high-density-' + currSizePrototype.size + '-size.jpg';

            let lowDensityPath = path.join('C:\\users\\apalaniuk\\desktop\\final-images', property, lowDensityFileName);
            let highDensityPath = path.join('C:\\users\\apalaniuk\\desktop\\final-images', property, highDensityFileName);

            let lowDensitySize = fs.statSync(lowDensityPath)['size'];
            let highDensitySize = fs.statSync(highDensityPath)['size'];

            sizes.push({
                width: currSizePrototype.width,
                height: currSizePrototype.height,
                density: 1,
                filesize: lowDensitySize,
                location: `/images/${clarifaiResults[property].id}/${lowDensityFileName}`
            });

            sizes.push({
                width: currSizePrototype.width,
                height: currSizePrototype.height,
                density: 2,
                filesize: highDensitySize,
                location: `/images/${clarifaiResults[property].id}/${highDensityFileName}`
            });
        }

        // Create database Object
        var databaseObj = {
            imageId: clarifaiResults[property].id,
            categories: {
                'en-us': clarifaiResults[property].categories
            },
            tags: {
                'en-us': clarifaiResults[property].results[0].result.tag.classes
            },
            name: fileName,
            sourceURL: clarifaiResults[property].sourceUrl || '',
            sizes: sizes
        };

        database.push(databaseObj);

        i++;

        if(i % 50 === 0) {
            console.log('Prepared ' + i + ' entries.');
        }
    }

    fs.writeFileSync('C:\\users\\apalaniuk\\desktop\\course-image-catalog\\imagesDataFile.json',
        JSON.stringify(database, null, 4)
    );
}

function ignoreFunc(file, stats) {
  // `file` is the absolute path to the file, and `stats` is an `fs.Stats` 
  return !stats.isDirectory() && path.parse(file).ext !== ".jpg";
}

function ignoreFunc2(file, stats) {
  // `file` is the absolute path to the file, and `stats` is an `fs.Stats` 
  return !stats.isDirectory() && path.parse(file).ext !== ".webloc";
}

function getJpegsFromDrive() {
    var files = recursivereaddir('D:/IMAGES', [ignoreFunc], 
        function (err, files) {
            if(err) {
                console.log(err);
            } else {
                // Files is an array of filename 
                //console.log(files);
                console.log('Complete; copying files..');
                for(var i = 0; i < files.length; i++ ){
                    var relPath = files[i].replace('D:\\IMAGES\\', '');
                    fs.copySync(files[i], path.join('C:\\users\\apalaniuk\\desktop\\jpegs', relPath));
                }

                console.log('File copy complete.');
            }
        }
    );
}

function getWeblocsFromDrive() {
    var files = recursivereaddir('D:/IMAGES', [ignoreFunc2], 
        function (err, files) {
            if(err) {
                console.log(err);
            } else {
                // Files is an array of filename 
                //console.log(files);
                console.log('Complete; copying weblocs..');
                for(var i = 0; i < files.length; i++ ){
                    var relPath = files[i].replace('D:\\IMAGES\\', '');
                    fs.copySync(files[i], path.join('C:\\users\\apalaniuk\\desktop\\weblocs', relPath));
                }

                console.log('File copy complete.');
            }
        }
    );
}

function normalizeNames(inDir) {
    var files = fsreaddirrecursive(inDir, function(fileName) {
        //console.log('Filtering ' + fileName);
        var ext = path.parse(fileName).ext;
        return ext !== '.txt';
    });

    var nameMap = {
            'CourseTile_145x60@1x.jpg':'tile-low-density-min-size.jpg',
            'CourseTile_145x60@2x.jpg':'tile-high-density-min-size.jpg',
            'CourseTile_220x95@1x.jpg':'tile-low-density-mid-size.jpg',
            'CourseTile_220x95@2x.jpg':'tile-high-density-mid-size.jpg',
            'CourseTile_540x230@1x.jpg':'tile-low-density-max-size.jpg',
            'CourseTile_540x230@2x.jpg':'tile-high-density-max-size.jpg',
            'Desktop& Tablet Course Banner_768x192@1x.jpg':'banner-wide-low-density-min-size.jpg',
            'Desktop& Tablet Course Banner_768x192@2x.jpg':'banner-wide-high-density-min-size.jpg',
            'Desktop& Tablet Course Banner_960x240@1x.jpg':'banner-wide-low-density-mid-size.jpg',
            'Desktop& Tablet Course Banner_960x240@2x.jpg':'banner-wide-high-density-mid-size.jpg',
            'Desktop& Tablet Course Banner_1200x300@1x.jpg':'banner-wide-low-density-max-size.jpg',
            'Desktop& Tablet Course Banner_1200x300@2x.jpg':'banner-wide-high-density-max-size.jpg',
            'MobileBanner_320x205@1x.jpg':'banner-narrow-low-density-min-size.jpg',
            'MobileBanner_320x205@2x.jpg':'banner-narrow-high-density-min-size.jpg',
            'MobileBanner_375x240@1x.jpg':'banner-narrow-low-density-mid-size.jpg',
            'MobileBanner_375x240@2x.jpg':'banner-narrow-high-density-mid-size.jpg',
            'MobileBanner_767x490@1x.jpg':'banner-narrow-low-density-max-size.jpg',
            'MobileBanner_767x490@2x.jpg':'banner-narrow-high-density-max-size.jpg'
        };

    for(var i = 0; i < files.length; i++) {

        var newName = undefined;
        //console.log(path.parse(files[i]).base);

        newName = nameMap[path.parse(files[i]).base];

        //console.log(path.parse(files[i]).dir);

        if (newName) {
            //console.log(path.join(inDir, newName));
            //console.log('New name: ' + newName);
            //console.log('In: ' + path.join(inDir, files[i]));
            //console.log('Out: ' + path.join(inDir, path.parse(files[i]).dir, newName));
            fs.renameSync(path.join(inDir, files[i]), path.join(inDir, path.parse(files[i]).dir, newName));
        }

        if(i % 100 === 0) {
            console.log('Processed ' + i + ' of ' + files.length + ' files.');
        }
    }

    console.log('Names normalized.');
    replServer.displayPrompt();
}

function getCategories(inFile) {
    const replacementName = {
        'aeronautical aerospace technology': 'aeronautical/aerospace technology',
        'art visual arts': 'art/visual arts',
        'drama theatre arts': 'drama/theatre arts',
        'structuressupport': 'structures/support',
        'english language arts': 'english/language arts',
        'foreign languages, middle near eastern': 'foreign languages, middle/near eastern',
        'resipiratory therapy': 'respiratory therapy',
        'enviromental and hazardous materials technology': 'environmental and hazardous materials technology',
        'general health public health': 'general health/public health'
    };

    fs.readFile(inFile, function(err, data) {
            var fileData = JSON.parse(data);
            var counter = 0;

            for(var property in fileData) {
                var relPath = property;     
                var categories = relPath.split('\\');
                var spliceAmount = 1;

                if(categories[0].toLowerCase() === 'default') {
                    console.log('Category is default..');
                    spliceAmount = 0;
                } else if(categories[0].toLowerCase() === 'topical') {
                    spliceAmount = 2;
                }

                categories.splice(0, spliceAmount);
                categories.splice(-1);

                for(var i = 0; i < categories.length; i++) {
                    var normalizedName = categories[i].toLowerCase();
                    
                    categories[i] = replacementName[normalizedName] || normalizedName;
                }

                fileData[property].categories = categories;
                if (counter++ >= 50) {
                    break;
                }
            }

            fs.writeFileSync('C:/clarifai_results_with_categories.json',
                JSON.stringify(fileData, null, 4)
            );

            //console.log(categoriesSet);

            console.log('Done.');
        });
}

function addSourceUrls(inDir) {
    try {
        var files = fsreaddirrecursive(inDir, function(fileName) {
            //console.log('Filtering ' + fileName);
            var ext = path.parse(fileName).ext;
            return !ext || ext === '.webloc';
        });

        var sourceUrls = [];

        let myPromise = new Promise(
            function(resolve, reject) {
                console.log('Number of files: ' + files.length);
                for(var i = 0; i < files.length; i++) {
                    //console.log(path.join(inDir, files[i]));
                    let currIndex = i;
                    let relFilePath = files[i];
                    let currFile = path.join(inDir, relFilePath);
                    weblocParser.getUrlFromFile(currFile).then(url => {
                        sourceUrls.push({file: relFilePath, url: url});
                        
                        if(currIndex === files.length - 1) {
                            console.log('URLs retrieved.');
                            console.log(sourceUrls);
                            resolve(sourceUrls);
                        }
                    }, function(reason) {
                        console.log('could not get url from ' + currFile + ': ' + reason);
                    });
                    
                    if(i % 100 === 0) {
                        console.log('Processed ' + i + ' of ' + files.length + ' files.');
                    }
                }
            }
        ).then(derrr => {
            // Add the URL to the correct object
            let keys = Object.keys(clarifaiResults);

            for(var currResult = 0; currResult < sourceUrls.length; currResult++) {
                let filePath = path.parse(sourceUrls[currResult].file).dir;
                let keyIndex = keys.indexOf(filePath);

                if(keyIndex === -1) {
                    console.log('Couldn\'t get index of ' + filePath);
                    //clarifaiResults[filePath].sourceUrl = '';
                } else {
                    clarifaiResults[filePath].sourceUrl = sourceUrls[currResult].url;
                }
            }
            replServer.displayPrompt();
        });
    } catch (e) {
        console.log('Couldn\'t parse urls: ' + e.toString());
    }
}

function removeAbsPath() {
    var newClarifaiResults = {};

    for(var property in clarifaiResults) {
        //console.log(property);
        var origPath = path.parse(path.normalize(property)).dir;
        var newPath = origPath.replace('C:\\Users\\apalaniuk\\Desktop\\final-images\\', '');

        newClarifaiResults[newPath] = clarifaiResults[property];
/*
        if(i % 100 === 0) {
            console.log('Prepared ' + i + ' entries.');
        }
        */
    }
    
    fs.writeFileSync(
        'C:\\clarifai_results_relative.txt', 
        JSON.stringify(newClarifaiResults, null, 4)
    );
}

function calcMinimumSetCover() {
    let outstandingConceptIds = new Set();
    let imagesArray = [];
    let numRequestsRequired = 0;

    // Create set of global concept IDs
    for(var property in clarifaiResults) {
        var conceptIds = clarifaiResults[property].results[0].result.tag.concept_ids;
        imagesArray.push(conceptIds);

        for(let concept of conceptIds) {
            outstandingConceptIds.add(concept);
        }
    }

    while(outstandingConceptIds.size > 0 && imagesArray.length > 0) {
        console.log(outstandingConceptIds.size + ' concepts still unknown.');
        //Sort images, descending
        imagesArray.sort(function(a, b) {
            return b.length - a.length;
        });

        let currImage = imagesArray[0];

        // Remove all concepts in set that are in this image
        for(let concept of currImage) {
            outstandingConceptIds.delete(concept);
        }

        if (outstandingConceptIds.size > 0) {
            for(let i = 1; i < imagesArray.length; i++) {
                let targetImage = imagesArray[i]; 

                if(targetImage) {
                    for(let concept of currImage) {
                        let conceptIndex = imagesArray[i].indexOf(concept);

                        if(conceptIndex !== -1) {
                            imagesArray[i].splice(conceptIndex, 1);
                        }
                    }
                }
            }

            imagesArray.splice(0, 1);
        }

        numRequestsRequired++;
    }

    console.log("Number of requests required: " + numRequestsRequired);
}

function setUUIDs(inFile) {
    let uuidSet = new Set();
    fs.readFile(inFile, function(err, data) {
            var fileData = JSON.parse(data);
            var counter = 0;

            for(var property in fileData) {
                var newUUID = uuid(property);

                if(uuidSet.has(newUUID)) {
                    throw new Error('UUID for ' + property + ' is duplicate..');
                }

                uuidSet.add(newUUID);

                fileData[property].id = newUUID;
            }

            fs.writeFileSync('C:\\clarifai_results_with_uuids.json',
                JSON.stringify(fileData, null, 4)
            );

            console.log('Done.');
        });
}

function myEval(cmd, context) {
    var args = cmd.trim().split(' ');

    if (args[0] === 'load') {
        fs.readFile(args[1], function(err, data) {
           clarifaiResults = JSON.parse(data); 
           console.log(Object.keys(clarifaiResults).length + ' entries loaded.');
        });
    } else if(args[0] === 'print') {
        console.log(JSON.stringify(clarifaiResults, null, 4));
    } else if(args[0] === 'convert') {
        convertToMap(args[1].trim());
    } else if(args[0] === 'start') {
        main(args[1].trim());
    } else if(args[0] === 'help') {
        console.log('start [input directory] [output file]\n\tGets tags for all images in [input directory], saved to [output file]\r');
        console.log('load [input file]\n\tPreloads data previously saved in [input file], so that progress can be resumed\r');
        console.log('convert [input file]\n\tConverts an input file from the old format (arrays) to new format (map)\r');
    } else if(args[0] === 'prepare') {
        prepare();
    } else if(args[0] === 'normalizeNames') {
        normalizeNames(args[1].trim());
    } else if(args[0] === 'getJpegs') {
        getJpegsFromDrive();
    } else if(args[0] === 'getCategories') {
        getCategories(args[1].trim());
    } else if(args[0] === 'get-weblocs') {
        getWeblocsFromDrive();
    } else if(args[0] === 'addSourceUrls') {
        addSourceUrls(args[1].trim());
    } else if(args[0] === 'removeAbsPath') {
        removeAbsPath();
    } else if(args[0] === 'calcMinimumSetCover') {
        calcMinimumSetCover();
    } else if(args[0] === 'setUUID') {
        setUUIDs(args[1].trim());
    }
    
    replServer.displayPrompt();
}