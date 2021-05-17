// ajax response hook
const hook = (callback, { filter }) => {
  const pattern = new RegExp(filter || '')
  const originOpen = XMLHttpRequest.prototype.open

  XMLHttpRequest.prototype.open = function () {
    this.addEventListener('load', function () {
      const { response, responseText, responseURL, status } = this
      if (status === 200 && pattern.test(responseURL)) {
        console.log(responseURL)
        callback && callback({
          response: response || responseText,
          url: responseURL
        })
      }
    }, false)
    originOpen.apply(this, arguments)
  }
}

// interceptor
hook(detail => {
  // send response to injection
  window.dispatchEvent(new CustomEvent('xhr', {
    detail
  }))
}, { filter: 'vd.l.qq.com/proxyhttp' })
