const { createApp, onMounted, reactive, toRefs, computed } = window.Vue
const app = createApp({
  name: 'Popup',
  template: `
      <main>
        <header>HLS Downloader</header>
        <section>
            <div class="quality">
                <p class="title">质量</p>
                <select ref="quality">
                        <option
                           v-for="option in options"
                           :value="option.value"
                           :key="option.value">
                           {{ option.label }}
                         </option>
                    </select>
            </div>

            <div class="download">
                <span>下载</span>
                <span>{{ downloadSize }} / {{ fragmentSize }}</span>
            </div>

            <div class="rate">
                <div class="panel">
                    <b>{{ rate }}</b>
                    <div class="progress" :style="{ width: rate }"></div>
                </div>
            </div>
        </section>
        <footer>
            <button class="outline" @click="handleReload">嗅探</button>
            <button :class="['primary', { 'disabled': !allowDownload }]" :disabled="!allowDownload">下载</button>
        </footer>
      </main>
    `,
  setup () {
    const { chrome } = window

    const state = reactive({
      tabId: null,
      quality: null,
      allowDownload: false,
      options: [{ label: '默认', value: 0 }],
      fragmentSize: 0,
      downloadSize: 0
    })

    const rate = computed(() => {
      return (state.downloadSize / state.fragmentSize) ? (state.downloadSize / state.fragmentSize).toFixed(2) : 0 + '%'
    })

    const handleReload = () => {
      state.tabId && chrome.tabs.reload(state.tabId)
    }

    onMounted(async () => {
      chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
        // 刷新当前窗口，以便进行接口拦截
        state.tabId = tab.id
        await chrome.tabs.reload(tab.id)

        chrome.webRequest.onBeforeRequest.addListener(({ method, url }) => {
          if (method === 'GET' && /.m3u8/.test(url)) {
            const [data] = url.match(/(?<=data=)(\S*?)(?=&)/g) || []
            if (!data) return false
            const { url: m3u8FilePath } = JSON.parse(decodeURIComponent(data)) || {}
            if (!m3u8FilePath) return false
          }
        }, { urls: ['*://btrace.video.qq.com/kvcollect*'] }, ['extraHeaders'])
      })
    })

    return {
      rate,
      ...toRefs(state),
      handleReload
    }
  }
})
app.mount('#app')
