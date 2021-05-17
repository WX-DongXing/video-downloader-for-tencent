// ajax response hook
const hook = (callback, { filter }) => {
  const pattern = new RegExp(filter || '')
  const XMLHttpRequestSend = window.XMLHttpRequest.prototype.send

  window.XMLHttpRequest.prototype.send = function () {
    const onreadystatechange = this.onreadystatechange

    this.onreadystatechange = () => {
      const { response, responseText, readyState, responseURL, status } = this
      if (readyState === 4 && status === 200 && pattern.test(responseURL)) {
        callback && callback({
          response: response || responseText,
          url: responseURL
        })
      }
      onreadystatechange(this)
    }

    XMLHttpRequestSend.apply(this, arguments)
  }
}

// interceptor
hook(response => {
  // send response to injection
  console.log(response)
  window.dispatchEvent(new CustomEvent('xhr', {
    response
  }))
}, { filter: 'proxyhttp' })
