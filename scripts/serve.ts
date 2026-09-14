// Serveur statique local pour dist/, sans dépendance.
// Usage : npm run serve   (port modifiable : PORT=3000 npm run serve)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve('dist');
const PORT = Number(process.env.PORT) || 8000;

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.webmanifest': 'application/manifest+json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
};

/** Chemin du fichier demandé dans dist/, ou null s'il sort du dossier. Lève une erreur si l'URL est mal encodée. */
function resolvePath(url: string): string | null {
	const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0] || '/');
	const path = normalize(join(ROOT, pathname));
	return path === ROOT || path.startsWith(ROOT + sep) ? path : null;
}

const server = createServer(async (request, response) => {
	try {
		let path = resolvePath(request.url ?? '/');
		if (!path) throw new Error('hors de dist/');
		if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
		const body = await readFile(path);
		response.writeHead(200, {
			'Content-Type': MIME_TYPES[extname(path)] ?? 'application/octet-stream',
			'Cache-Control': 'no-store',
		});
		response.end(request.method === 'HEAD' ? undefined : body);
	} catch {
		response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
		response.end('Introuvable');
	}
	console.log(`${response.statusCode} ${request.method} ${request.url}`);
});

server.listen(PORT, () => {
	console.log(`Boule de cristal : http://localhost:${PORT}/ (Ctrl+C pour arrêter)`);
});
