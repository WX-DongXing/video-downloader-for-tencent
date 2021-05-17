const interceptor = document.createElement('script')
interceptor.setAttribute('type', 'text/javascript')
interceptor.setAttribute('src', chrome.extension.getURL('scripts/interceptor.js'))
document.documentElement.appendChild(interceptor)

// send response
window.addEventListener('xhr', (event) => {
  chrome.runtime.sendMessage({ type: 'xhr', ...event.detail })
}, false)
