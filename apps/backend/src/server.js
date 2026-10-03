import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const { app, close, ready } = createApp(config);
await ready;
const server = app.listen(config.port, config.host);
server.once('listening', () => {
  console.log(`Ghostdrop is listening on http://${config.host}:${server.address().port}`);
});
server.once('error', (err) => {
  console.error(`Could not start Ghostdrop: ${err.message}`);
  close();
  process.exit(1);
});
server.requestTimeout = 15 * 60_000;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(async () => {
      await close();
      process.exit(0);
    });
  });
}
