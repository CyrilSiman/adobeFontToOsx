import commander from 'commander'
import username from 'username'
import readline from 'readline'
import log4js from 'log4js'
import fsExtra from 'fs-extra'
import util from 'util'
import fs from 'fs'
import _ from 'lodash'
import path from 'path'

const DEBUG_VALUE = ["ALL","TRACE","DEBUG","INFO","WARN","ERROR","FATAL","MARK","OFF"]

const index = DEBUG_VALUE.indexOf(process.env.DEBUG_LEVEL.toUpperCase())
const debugLevel = index != -1 ? DEBUG_VALUE[index] : "debug"

log4js.configure({
    appenders: {
      out: { type: 'stdout' },
      app: { type: 'file', filename: 'application.log' }
    },
    categories: {
      default: { appenders: [ 'out', 'app' ], level: debugLevel }
    }
  })

const logger = log4js.getLogger()

var dstFolderValue

commander
    .version('1.0.0')
    .arguments('<dstFolder>')
    .action(function (dstFolder) {
        dstFolderValue = dstFolder
    })
    .parse(process.argv);

    if (typeof dstFolderValue === 'undefined') {
        console.error('no dst folder given!');
        process.exit(1);
     }

async function main() {

    let stats
    
    //If path doesn't exist
    if(!fsExtra.pathExistsSync(dstFolderValue)){
        console.log(`The folder ${dstFolderValue} was created`);
        fsExtra.ensureDirSync(dstFolderValue)
    } else { 
        //Check if existing dstFolder isn't a file.
        try {
            stats = await fsExtra.stat(dstFolderValue)
    
            if (stats.isFile && !stats.isDirectory ) {
                console.log("The dstFolder must be a folder not a file");
                process.exit(1);
            } 
        } catch (error) {
            console.log("The dstFolder must can't be read.\r\n" + error);
            process.exit(1);
        }
    }

    let usernameValue =  await username();
    logger.info(`Search Adobe Fonts Cache file for user :  ${usernameValue}`)

    let adobeFilePath =  `/Users/${usernameValue}/Library/Application Support/Adobe/Adobe Photoshop CC 2019/CT Font Cache/AdobeFnt_OSFonts.lst`

    try {
        stats = await fsExtra.stat(adobeFilePath)

        if (!stats.isFile) {
            console.log("The Adobe font file can't be find");
            process.exit(1);
        } 
    } catch (error) {
        console.log("The Adobe font file can't be find.\r\n" + error);
        process.exit(1);
    }

    
    dstFolderValue = path.resolve(dstFolderValue);
    /*
    var lineReader = readline.createInterface({
        input: fs.createReadStream(adobeFilePath)
      });
      */

    const readFileWithPromise = util.promisify(fs.readFile);
    let contents = await fsExtra.readFile(adobeFilePath,'utf8')
    
    let fontsArray = contents.split('%BeginFont')
    let fontsCopied = 0

    fontsArray.map(value => {
        if(copyRenameAndSaveFont(readFontContent(value),dstFolderValue,usernameValue)) {
            fontsCopied++
        }
    })

    console.log(`${fontsArray.length} fonts found`)
    console.log(`${fontsCopied} fonts copied`)
}

function copyRenameAndSaveFont(font,dstFolderValue,usernameValue) {
    let returnValue = false
    if ((_.has(font,'FontName') && _.has(font,'OutlineFileName'))) {
        let fontPath = font['OutlineFileName'].split("#")[0].slice(7)
        fontPath = fontPath.replace('%20'," ")

        if(fontPath.startsWith(`/Users/${usernameValue}/Library/Application Support/Adobe`)) {
            let extension = fontPath.split(".").slice(-1)
            let fontName = font['FontName']

            fs.copyFile(fontPath, `${dstFolderValue}/${fontName}.${extension}`, (err) => {
                if (err) throw err;
                //console.log(`Copy ${fontPath} to ${dstFolderValue}/${fontName}.${extension}`)
                console.log(`${fontPath} was copied to ${dstFolderValue}/${fontName}.${extension}`);
                returnValue = true
              });
            
            


        }
    }
    return returnValue
}

/**
 * Read font content
 * @param {string} fontsContent 
 * @returns {string} font
 */
function readFontContent(fontsContent) {
    //Split by line and make Array
    let lines = fontsContent.split("\n")
    let font = lines.reduce((result,value) => {
        let values = value.split(":")
        if(values.length > 2){
            let [key,...rest] = values
            result[key] = rest.join(":")
        } else {
            result[values[0]] = values[1]
        }
        return result
    },{})
    return font
}


main()