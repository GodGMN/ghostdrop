import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const { app, close } = createApp(config);
const server = app.listen(config.port, config.host, () => {
  console.log(`Ghostdrop is listening on http://${config.host}:${server.address().port}`);
});
server.requestTimeout = 15 * 60_000;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { server.close(() => { close(); process.exit(0); }); });
}
