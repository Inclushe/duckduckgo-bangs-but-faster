const patterns = [ '*://duckduckgo.com/*', '*://bangs-but-faster.invalid/*' ]
const lookup = {}

// eslint-disable-next-line no-undef
fetch('https://duckduckgo.com/bang.js')
  .then(data => data.json())
  .then(json => {
    json.forEach(entry => {
      lookup[entry.t] = entry.u
    })
  })
  .catch(e => console.error(e))

async function fallbackSearch (query) {
    const engines = await browser.search.get()
    for (let i = 0; i < engines.length; i++) {
        if (engines[i]['isDefault']) {
	  let usedEngine = engines[i]['name']
	  if (engines[i]['name'] === 'DDG !Bangs') {
	      usedEngine = engines[1]['name']
	  }
	  browser.search.search({
	      query: query,
	      engine: usedEngine,
	      disposition: 'CURRENT_TAB'
	  })
        }
    }
}

function redirect (requestDetails) {
  const url = new URL(requestDetails.url)
  const params = new URLSearchParams(url.search)
  const query = params.get('q')
  if (query === null) return { cancel: false }
  const queryArray = query.split(' ')
  let foundMatchingBang = false
  let newSearchURL = ''
  const string = queryArray.filter((word, index) => {
    if (word[0] === '!' && lookup[word.slice(1)] !== undefined && !foundMatchingBang) {
      newSearchURL = lookup[word.slice(1)]
      foundMatchingBang = true
      return false;
    }
    if (word === '') {
      return false
    }
    return true
  }).join(' ')

  if (foundMatchingBang) {
    return {
      redirectUrl: newSearchURL.replace('{{{s}}}', encodeURIComponent(string))
    }
  } else if (url.hostname === 'bangs-but-faster.invalid') {
    fallbackSearch(string)
  }
  return {
    cancel: false
  }
}

// This is used to downgrade the form-action content security policy in order to allow !bangs to work on DuckDuckGo's search page
function rewriteCSP (requestDetails) {
  for (var i = 0; i < requestDetails.responseHeaders.length; ++i) {
    if (requestDetails.responseHeaders[i].name === 'content-security-policy') {
      requestDetails.responseHeaders[i].value = requestDetails.responseHeaders[i].value.replace(/form-action [^;]*;/, 'form-action  * ;')
    }
  }
  return { responseHeaders: requestDetails.responseHeaders }
}

// eslint-disable-next-line no-undef
browser.webRequest.onBeforeRequest.addListener(
  redirect,
  { urls: patterns, types: ['main_frame'] },
  ['blocking']
)

// eslint-disable-next-line no-undef
chrome.webRequest.onHeadersReceived.addListener(
  rewriteCSP,
  { urls: patterns },
  ['blocking', 'responseHeaders']
)
