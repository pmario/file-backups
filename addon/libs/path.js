"use strict";

// Minimal path helper for file-backups. Exposes `pathLib` on the global object
// with both `win32` and `posix` variants. Replaces the webpack-bundled Node
// `path` polyfill (46 KB) with ~100 lines covering only what we use:
//
//   parse(p)           -> { root, dir, base, ext, name }
//   format(obj)        -> string
//   join(...parts)     -> string
//   basename(p)        -> string
//   relative(from, to) -> string
//   isAbsolute(p)      -> boolean
//   sep                -> "\\" or "/"
//
// Semantics match Node's `path` module for the inputs this extension actually
// produces (absolute filesystem paths returned by browser.downloads and paths
// built from them). No URL/query parsing, no "." / ".." normalisation beyond
// what relative() needs.

(function (root) {
	function makeVariant(sep) {
		const isWin = sep === "\\";
		const splitRe = isWin ? /[\\/]+/ : /\/+/;

		function isAbsolute(p) {
			if (!p) return false;
			if (isWin) {
				// "C:\foo", "C:/foo", "\\server\share", "\foo"
				return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("\\\\") || p.startsWith("\\") || p.startsWith("/");
			}
			return p.startsWith("/");
		}

		function parse(p) {
			const out = { root: "", dir: "", base: "", ext: "", name: "" };
			if (!p) return out;

			let rest = p;
			if (isWin) {
				const m = /^([a-zA-Z]:)([\\/])?/.exec(p);
				if (m) {
					out.root = m[1] + (m[2] || "");
					rest = p.slice(m[0].length);
				} else if (p.startsWith("\\\\") || p.startsWith("//")) {
					// UNC: \\server\share\...
					out.root = p.slice(0, 2);
					rest = p.slice(2);
				} else if (p.startsWith("\\") || p.startsWith("/")) {
					out.root = p[0];
					rest = p.slice(1);
				}
			} else if (p.startsWith("/")) {
				out.root = "/";
				rest = p.slice(1);
			}

			// Split remaining into segments, last is base.
			const segs = rest.split(splitRe).filter(Boolean);
			out.base = segs.pop() || "";
			out.dir = out.root + segs.join(sep);
			if (!out.dir && out.root) out.dir = out.root;

			// Split base into name + ext; leading dot (".bashrc") stays as name.
			const dot = out.base.lastIndexOf(".");
			if (dot > 0) {
				out.name = out.base.slice(0, dot);
				out.ext = out.base.slice(dot);
			} else {
				out.name = out.base;
				out.ext = "";
			}
			return out;
		}

		function format(obj) {
			const base = obj.base || ((obj.name || "") + (obj.ext || ""));
			const dir = obj.dir || obj.root || "";
			if (!dir) return base;
			if (dir === obj.root) return dir + base;
			return dir + sep + base;
		}

		function basename(p) {
			return parse(p).base;
		}

		function join(...parts) {
			const nonEmpty = parts.filter(x => x !== undefined && x !== null && x !== "");
			if (nonEmpty.length === 0) return ".";

			// Join, then collapse separator runs (keep a leading UNC prefix).
			let joined = nonEmpty.join(sep);
			if (isWin) {
				const uncPrefix = joined.startsWith("\\\\") ? "\\\\" : (joined.startsWith("//") ? "//" : "");
				joined = uncPrefix + joined.slice(uncPrefix.length).replace(/[\\/]+/g, sep);
			} else {
				joined = joined.replace(/\/+/g, sep);
			}

			// Drop "." segments (but keep ".."). Matches Node's path.join behaviour:
			// ".\\foo" -> "foo", "./foo" -> "foo", "foo/./bar" -> "foo/bar".
			// A result of just "." stays as ".".
			const abs = isAbsolute(joined);
			const rootMatch = isWin ? /^(?:[a-zA-Z]:[\\/]?|[\\/]{1,2})/.exec(joined) : /^\/+/.exec(joined);
			const rootPart = rootMatch ? rootMatch[0] : "";
			const rest = joined.slice(rootPart.length);
			const kept = rest.split(splitRe).filter(s => s !== "" && s !== ".");
			const out = rootPart + kept.join(sep);
			if (out === "") return abs ? rootPart : ".";
			return out;
		}

		// Normalise a split list, resolving "." and "..". Returns a fresh array.
		function normaliseSegments(segs) {
			const out = [];
			for (const s of segs) {
				if (s === "" || s === ".") continue;
				if (s === "..") {
					if (out.length > 0 && out[out.length - 1] !== "..") out.pop();
					else out.push("..");
				} else {
					out.push(s);
				}
			}
			return out;
		}

		function splitAbs(p) {
			const parsed = parse(p);
			const segs = p.slice(parsed.root.length).split(splitRe).filter(Boolean);
			return { root: parsed.root, segs: normaliseSegments(segs) };
		}

		function relative(from, to) {
			const f = splitAbs(from);
			const t = splitAbs(to);

			// Different roots -> can't make relative; return `to` unchanged.
			const rootEq = isWin
				? f.root.toLowerCase() === t.root.toLowerCase()
				: f.root === t.root;
			if (!rootEq) return to;

			let i = 0;
			const cmp = (a, b) => isWin ? a.toLowerCase() === b.toLowerCase() : a === b;
			while (i < f.segs.length && i < t.segs.length && cmp(f.segs[i], t.segs[i])) i++;

			const ups = new Array(f.segs.length - i).fill("..");
			const downs = t.segs.slice(i);
			const all = ups.concat(downs);
			return all.length ? all.join(sep) : "";
		}

		return {
			sep,
			parse,
			format,
			basename,
			join,
			relative,
			isAbsolute,
		};
	}

	const win32 = makeVariant("\\");
	const posix = makeVariant("/");

	root.pathLib = { win32, posix };
})(typeof globalThis !== "undefined" ? globalThis : this);
