import { defineStore } from 'pinia'

interface AppState {
  initialized: boolean
  username: string
  version: string
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    initialized: false,
    username: '',
    version: ''
  }),
  actions: {
    init() {
      this.initialized = true
    },
    setUsername(name: string) {
      this.username = name
    }
  }
})
