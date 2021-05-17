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
                <span>{{ buffers.length }} / {{ segments.length }}</span>
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
    const { chrome, m3u8Parser } = window

    const state = reactive({
      tabId: null,
      quality: null,
      allowDownload: false,
      options: [{ label: '默认', value: 0 }],
      playlists: [],
      manifest: {},
      segments: [],
      buffers: []
    })

    const rate = computed(() => {
      const value = (state.buffers.length / state.segments.length * 100)
      return `${value ? value.toFixed() : 0}%`
    })

    const request = (url, option) => new Promise((resolve, reject) => {
      const { type = 'text', ...prop } = { ...option }
      fetch(new Request(url))
        .then(response => response.blob())
        .then(blob => type === 'text' ? blob.text() : blob.arrayBuffer())
        .then(data => resolve({ data, ...prop }))
        .catch(reject)
    })

    const handleReload = () => {
      state.tabId && chrome.tabs.reload(state.tabId)
      Object.assign(state, {
        allowDownload: false,
        options: [{ label: '默认', value: 0 }],
        playlists: [],
        manifest: {},
        segments: [],
        buffers: []
      })
    }

    onMounted(async () => {
      chrome.runtime.onMessage.addListener(({ response }) => {
        const { vinfo } = JSON.parse(response)
        if (!vinfo) return
        const info = JSON.parse(vinfo)
        console.log('xhr: ', info)
      })

      chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
        // 刷新当前窗口，以便进行接口拦截
        state.tabId = tab.id
        await chrome.tabs.reload(tab.id)

        // chrome.webRequest.onBeforeRequest.addListener(async ({ method, url }) => {
        //   if (method === 'GET' && /.m3u8/.test(url)) {
        //     const [data] = url.match(/(?<=data=)(\S*?)(?=&)/g) || []
        //     if (!data) return false
        //     const { url: m3u8FilePath } = JSON.parse(decodeURIComponent(data)) || {}
        //     if (!m3u8FilePath) return false
        //
        //     const result = await request('http://devimages.apple.com/iphone/samples/bipbop/bipbopall.m3u8', { index: 1 })
        //     const parser = new m3u8Parser.Parser()
        //     parser.push(result.data)
        //     parser.end()
        //
        //     const { playlists, manifest } = parser
        //
        //     state.playlists = playlists || []
        //     state.manifest = manifest || {}
        //
        //     if (playlists.length) {
        //       // state.options =
        //     } else {
        //       state.segments = manifest.segments
        //     }
        //
        //     console.log(parser)
        //   }
        // }, { urls: ['*://btrace.video.qq.com/kvcollect*'] }, ['extraHeaders'])
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
