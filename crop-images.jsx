#target photoshop

var currOutFile = 0;

var inputFolder = null;
var outputFolder = null;
var cropSizes = {
    courseTile: [ 
        [540, 230],
        [220, 95],
        [145, 60]
    ],
    courseBannerDesktop: [
        [1200, 300],
        [960, 240],
        [768, 192]
    ],
    courseBannerMobile: [
        [767, 490],
        [375, 240],
        [320, 205]
    ]
};

// Adobe's subset of JS doesn't provide an easy way of iterating over object properties =(
var copyMetadata = function(src, target) {
    target.info.source = src.info.source;
}

var saveJPEG = function(doc, saveFile, quality) {  
     var saveOptions = new JPEGSaveOptions( );  
     saveOptions.embedColorProfile = false;  
     saveOptions.formatOptions = FormatOptions.STANDARDBASELINE;  
     saveOptions.matte = MatteType.NONE;  
     saveOptions.quality = quality;   
     doc.saveAs( saveFile, saveOptions, true );  
}

function saveForWebJPEG(doc, saveFile, quality) {  
    var prevDialogsMode = app.displayDialogs;
    app.displayDialogs = DialogModes.NO; 
    var saveOptions = new ExportOptionsSaveForWeb();   
    saveOptions.format = SaveDocumentType.JPEG;   
    saveOptions.includeProfile = false;   
    saveOptions.interlaced = 0;   
    saveOptions.optimized = true;   
    saveOptions.quality = quality; //0-100   
    activeDocument.exportDocument(saveFile, ExportType.SAVEFORWEB, saveOptions);  
    app.displayDialogs = prevDialogsMode;
}  

var processPsdFile = function(imageFile) {

    var thisCropSizes;
    var imageDoc = undefined;

    if(imageFile.displayName.indexOf('Course Tile') !== -1) {
        thisCropSizes = cropSizes.courseTile;
    } else if(imageFile.displayName.indexOf('Course Banner') !== -1) {
        thisCropSizes = cropSizes.courseBannerDesktop;
    } else if(imageFile.displayName.indexOf('Mobile Banner') !== -1) {
        thisCropSizes = cropSizes.courseBannerMobile;
    } else {
        return;
    }
    
    var imgOutputFolderName = outputFolder + imageFile.path.replace(inputFolder.fullName, '');
    var imgOutputFolder = new Folder(imgOutputFolderName);    
    
    // open image
    try {
        imageDoc = app.open(imageFile);
    } catch(e) {
        $.write('Could not open PSD ' + imageFile.displayName + ': ' + e + '\n');
        return;
    }
    
    imgOutputFolder.create();
    
    var originalImageState = imageDoc.activeHistoryState;

    // for each pixel density
    for(var pixelDensity = 1; pixelDensity <= 2; pixelDensity++) {
        // for each crop size
        for(var i = 0; i < thisCropSizes.length; i++) {
            var tempCropSize = thisCropSizes[i].slice();
            tempCropSize[0] *= pixelDensity;
            tempCropSize[1] *= pixelDensity;
            
            // create a new JPEG
            var outFileName = imgOutputFolderName + '/' + imageFile.displayName.replace(' ', '').replace(
                '.psd', 
                '_' + thisCropSizes[i][0] + 'x' + thisCropSizes[i][1] + '@' + pixelDensity + 'x.jpg'
            );

            imageDoc.resizeImage(UnitValue(tempCropSize[0],"px"), UnitValue(tempCropSize[1], 'px'), null, ResampleMethod.BICUBIC, 0);
            
            var newFile = File(outFileName);

            if(newFile.exists === true) {
                $.write('File ' + newFile.fullName + ' already exists... skipping.\n');
                imageDoc.close(SaveOptions.DONOTSAVECHANGES);
                return;
            }
        
            // Open the newly-exported file to export metadata    
            newFileDoc = app.open(File(outFileName));
            copyMetadata(imageDoc, newFileDoc);
            saveJPEG(imageDoc, newFile, 8);
            newFileDoc.close(SaveOptions.DONOTSAVECHANGES);
            imageDoc.activeHistoryState = originalImageState;
        }
    }

    imageDoc.close(SaveOptions.DONOTSAVECHANGES);
};

var processDirectory = function(folder) {
    var children = folder.getFiles();    
    var psdFiles = [];
    var subDirs = [];

    for(var i = 0; i < children.length; i++) {
        if(children[i] instanceof File && children[i].displayName.indexOf('.psd') !== -1) {
            psdFiles.push(children[i]);
        } else if(children[i] instanceof Folder) {
            subDirs.push(children[i]);
        }
     }

    // If we've already generated all thumbnails for these source images, skip it
    if(subDirs.length === 0 && psdFiles.length > 0) {
        var thisOutputFolderName = outputFolder + folder.fullName.replace(inputFolder.fullName, '');
        var thisOutputFolder = new Folder(thisOutputFolderName);    
    
        if(thisOutputFolder.getFiles().length >= 18) {
            return;
        }
    }

     // Process all images in this folder
     for(i = 0; i < psdFiles.length; i++) {
         processPsdFile(psdFiles[i]);
     }

     // Walk any subdirectories
     for(i = 0; i < subDirs.length; i++) {
         processDirectory(subDirs[i]);
     }
};

function main() {
    inputFolder = Folder.selectDialog("Select a folder to process");
    outputFolder = Folder.selectDialog("Select a folder to save modified images to");
    processDirectory(inputFolder);
    alert("All files processed.");
}

app.preferences.rulerUnits = Units.PIXELS;
main();
