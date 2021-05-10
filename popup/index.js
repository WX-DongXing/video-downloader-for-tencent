const { createApp, onMounted } = window.Vue
const app = createApp({
  name: 'Popup',
  template: `
      <div class="wrap">
        <p class="title">HSL Video DownLoader</p>
      </div>
    `,
  setup () {
    onMounted(() => {
      console.log('here')
    })
  }
})
app.mount('#app')
