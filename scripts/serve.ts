// Serveur statique local pour dist/, sans dépendance.
// Usage : npm run serve   (port modifiable : PORT=3000 npm run serve)
import { startStaticServer } from './static-server.ts';

const PORT = Number(process.env.PORT) || 8000;

const { url } = await startStaticServer('dist', PORT, (line) => console.log(line));
console.log(`Boule de cristal : ${url} (Ctrl+C pour arrêter)`);
