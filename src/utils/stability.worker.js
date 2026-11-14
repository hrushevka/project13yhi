import { forecastStability } from './stability.js';
self.onmessage = ({ data }) => self.postMessage(forecastStability(data));
