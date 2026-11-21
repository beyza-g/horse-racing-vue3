import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';

import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { parseSeed, useRaceStore } from './stores/race';

const pinia = createPinia();
const app = createApp(App).use(pinia);
// `?seed=123` makes horses, programs and results reproducible (used by E2E tests).
useRaceStore(pinia).initialize(parseSeed(window.location.search));
app.mount('#app');
