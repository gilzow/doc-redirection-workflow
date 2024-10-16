const core = require('@actions/core')
const github = require('@actions/github')
const fs = require('fs');
const yaml = require('js-yaml');
const axios = require('axios');
const problems = new Map()
const tableData = [
  [
    {data: 'From', header: true},
    {data: 'To', header: true}
  ]
]

function linkify(path,url) {
  let link = ""
  /**
   * [text](full-url)
   * where:
   * text == path
   * full-url == url+path
   */

  /**
   * We only want to append the URL if the path doesnt already start with https
   */
  if (!path.startsWith('https:')) {
    if(url.endsWith('/')) {
      url = url.slice(0,-1);
    }

    link = url+path;

  } else {
    link = path;
  }

  return `[${path}](${link})`
}

/**
 * @todo should we verify that the URL is valid before we set it?
 * @type {string}
 */
axios.defaults.baseURL = core.getInput('environment-url')

try {
  /**
   * Can we get the full workspace path to this file?
   * @type {*}
   */
  const yamlData = yaml.load(fs.readFileSync('./.platform/routes.yaml', 'utf8'));
  /**
   * @todo the key (docs.upsun.com) here should be a variable that is set somewhere else
   * @type {Record<string, string[]> | _.LodashAt | ((request: string) => (string[] | null)) | string[]}
   */
  const anchors = yamlData['https://docs.upsun.com/'].redirects.paths

  const RedirectKeys = Object.keys(anchors).filter((path)=>{
    /**
     * @todo the piece we're using to identify our contracts (/anchors/) should be a variable
     */
    return path.startsWith('/anchors/')
  })

  const validateRedirects = RedirectKeys.map(async (path, index, array) => {
      //console.log(`I'm going to test ${path} to see if it goes to ${anchors[path].to}`)

      try {
        const response = await axios.head(path);
        core.info(`Response for our check of ${path} is ${response.status}`)
        return response
      } catch (reqerr) {
        core.warning(`issue encountered with path ${path}!!! Returned status is ${reqerr.status}`)
        let row = [{data: linkify(path, axios.defaults.baseURL)},{data: linkify( anchors[path].to, axios.defaults.baseURL) }]
        tableData.push(row)
        //problems.set(path,anchors[path].to)
      }
    });


  Promise.all(validateRedirects).then(() => {
    if(tableData.length > 1) {
      /**
       * @todo swap this out with core.summary.addTable()
       */
      core.error('There was an error with one or more redirects.')
      // core.startGroup('Redirections that failed')
      // const mapBad = Object.fromEntries(problems)
      // core.info(JSON.stringify(mapBad))
      // core.endGroup()
      // let aryProblems = Array.from(problems,([from,to]) => ({from,to}))
      // core.summary.addTable([aryProblems])
      // const tableData = [
      //     [
      //       {data: 'Header1', header: true},
      //       {data: 'Header2', header: true},
      //       {data: 'Header3', header: true},
      //     ],
      //     [
      //       {data: 'MyData1'},
      //       {data: 'MyData2'},
      //       {data: 'MyData3'}
      //     ],
      // ]

      core.summary.addTable(tableData)

      core.summary.write()
      core.setFailed('There was an error with one or more contracted redirects.')
    } else  {
      core.notice('All contracted redirections are valid.')
    }
  });

} catch (error) {
  core.setFailed(`Action failed with error ${error}`)
}


