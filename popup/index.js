const { createApp, onMounted, reactive, toRefs, computed } = window.Vue
const app = createApp({
  name: 'Popup',
  template: `
      <main>
        <header>HLS Downloader</header>
        <section>
            <div class="info">
                <p class="title">名称</p>
                <p>{{ title }}</p>
            </div>

            <div class="quality">
                <p class="title">质量</p>
                <select ref="select" @change="handleSwitchQuality">
                        <option
                           v-for="option in options"
                           :value="option.id"
                           :key="option.id">
                           {{ option.sname }}
                         </option>
                    </select>
            </div>

            <div class="download">
                <span><b>下载</b></span>
                <span>{{ size }} / {{ segments.length }}</span>
            </div>

            <div class="rate">
                <div class="panel" v-if="status !== 'DECODE'">
                    <b>{{ rate }}</b>
                    <div class="progress" :style="{ width: rate }"></div>
                </div>
                <div class="panel" v-else>
                    <b>正在转码</b>
                </div>
            </div>
        </section>
        <footer>
            <button class="outline" @click="handleReload">嗅探</button>
            <button :class="['primary', { 'disabled': !allowDownload }]" :disabled="!allowDownload" @click="handleDownload">下载</button>
        </footer>
      </main>
    `,
  setup () {
    const { chrome, m3u8Parser, FFmpeg } = window
    const { createFFmpeg } = FFmpeg

    const state = reactive({
      tabId: null,
      select: null,
      fileUrl: null,
      allowDownload: true,
      title: '',
      options: [{ sname: '默认', id: 0 }],
      playlists: [],
      manifest: {},
      segments: [],
      buffers: [],
      size: 0,
      abort: null
    })

    const rate = computed(() => {
      const value = (state.size / state.segments.length * 100)
      return `${value ? value.toFixed() : 0}%`
    })

    const status = computed(() => {
      const value = state.size / state.segments.length
      if (value === 0) {
        return 'INIT'
      } else if (value === 1) {
        return 'DECODE'
      } else {
        return 'DOWNLOAD'
      }
    })

    const reset = () => {
      Object.assign(state, {
        allowDownload: true,
        title: '',
        playlists: [],
        manifest: {},
        segments: [],
        buffers: [],
        size: 0,
        abort: null
      })
    }

    const createRequest = (url, option) => {
      let controller
      const request = () => new Promise((resolve, reject) => {
        const { type = 'text', ...prop } = { ...option }
        controller = new AbortController()
        const { signal } = controller
        fetch(new Request(url), { signal })
          .then(response => response.blob())
          .then(blob => type === 'text' ? blob.text() : blob.arrayBuffer())
          .then(data => resolve({ data, ...prop }))
          .catch(reject)
      })

      return {
        request,
        abort: () => {
          controller.abort()
        }
      }
    }

    const createFetchSegments = (paths, concurrent = 8) => {
      let rej
      const abortList = []

      const fetchSegments = () => new Promise((resolve, reject) => {
        rej = reject
        const pathLength = paths.length
        const results = []
        const queryList = []

        const recursionRequest = () => {
          const path = paths.shift()
          if (!path) return
          queryList.push(path)
          const { request, abort } = createRequest(path, { type: 'arraybuffer', index: pathLength - paths.length })
          abortList.push(abort)
          request()
            .then(({ data, index }) => {
              state.size += 1
              results.push({ index, data })
              queryList.shift()
              if (results.length === pathLength) {
                resolve(results)
              }
              if (queryList.length < concurrent) {
                recursionRequest()
              }
            })
            .catch(e => {
              throw e
            })
          if (queryList.length < concurrent) {
            recursionRequest()
          }
        }
        recursionRequest()
      })
      return {
        fetchSegments,
        abort: () => {
          if (abortList.length) {
            paths = []
            abortList.forEach(abort => abort())
          }
          rej({ message: 'Abort!', rejected: true })
        }
      }
    }

    const handleDownload = async () => {
      try {
        if (state.segments.length) {
          state.allowDownload = false
          const paths = state.segments.map(segment => segment.uri)
          const { fetchSegments, abort } = createFetchSegments(paths)
          state.abort = abort
          const segments = await fetchSegments()

          const { uintArrays, length } = segments
            .sort((a, b) => a.index - b.index)
            .reduce((acc, cur) => {
              const uintArray = new Uint8Array(cur.data)
              acc.length += uintArray.length
              acc.uintArrays.push(uintArray)
              return acc
            }, { uintArrays: [], length: 0 })

          // merge buffers
          const { buffers } = uintArrays.reduce((acc, cur) => {
            acc.buffers.set(cur, acc.length)
            acc.length += cur.length
            return acc
          }, { buffers: new Uint8Array(length), length: 0 })

          // Decode
          const ffmpeg = createFFmpeg({ log: true })
          await ffmpeg.load()
          ffmpeg.FS('writeFile', 'source.ts', buffers)
          await ffmpeg.run('-i', 'source.ts', 'output.mp4')
          const data = ffmpeg.FS('readFile', 'output.mp4')

          // Download
          const blob = new Blob([data.buffer])
          const link = document.createElement('a')
          link.href = window.URL.createObjectURL(blob)
          link.setAttribute('download', `${state.title}.mp4`)
          link.click()
          window.URL.revokeObjectURL(link.href)
          reset()
        }
      } catch (e) {
        console.log('Error: ', e)
        reset()
      }
    }

    const handleParseM3u8 = async () => {
      console.log(state.fileUrl)
      const baseUrl = state.fileUrl.replace(/(\S+\/)\S+/, '$1')
      const { request } = createRequest(state.fileUrl)
      const result = await request()
      const parser = new m3u8Parser.Parser()
      parser.push(result.data)
      parser.end()
      const { segments } = parser.manifest || {}
      state.segments = segments.map(segment => {
        segment.uri = baseUrl + segment.uri
        return segment
      })
    }

    const handleSwitchQuality = async ({ target: { value } }) => {
      state.abort && state.abort()
      const index = state.options.findIndex(option => +option.id === +value)
      state.fileUrl = state.playlists[index].url
      await handleParseM3u8()
    }

    const handleReload = () => {
      state.abort && state.abort()
      state.tabId && chrome.tabs.reload(state.tabId)
      reset()
    }

    onMounted(async () => {
      chrome.runtime.onMessage.addListener(({ response }) => {
        const { vinfo } = JSON.parse(response)
        console.log(JSON.parse(vinfo))
        if (!vinfo) return
        const { fl: { fi }, vl: { vi } } = JSON.parse(vinfo)
        if (!state.playlists.length) {
          state.options = fi
          state.playlists = vi[0]?.ul?.ui
          state.title = vi[0]?.ti
          state.fileUrl = [...state.playlists].pop().url
          handleParseM3u8()
        }
      })

      chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
        // 刷新当前窗口，以便进行接口拦截
        state.tabId = tab.id
        await chrome.tabs.reload(tab.id)
      })
    })

    return {
      rate,
      status,
      ...toRefs(state),
      handleReload,
      handleSwitchQuality,
      handleDownload
    }
  }
})
app.mount('#app')
