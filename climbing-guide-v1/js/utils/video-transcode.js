import { fileLooksLikeHevc } from "./video-hevc.js";

const CORE_BASE =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

const DEFAULT_MAX_BYTES = 80 * 1024 * 1024;

/** @type {Promise<import('@ffmpeg/ffmpeg').FFmpeg> | null} */
let ffmpegLoadPromise = null;

function baseName(name) {
  return (
    String(name || "video")
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 80) || "video"
  );
}

function inputExtension(file) {
  const match = String(file?.name || "")
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  const ext = match?.[1];
  if (ext === "mov" || ext === "mp4" || ext === "m4v" || ext === "webm" || ext === "ogg") {
    return ext;
  }
  return "mp4";
}

async function getFfmpeg({ onStatus } = {}) {
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      onStatus?.("Loading converter…");
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })().catch((error) => {
      ffmpegLoadPromise = null;
      throw error;
    });
  }
  return ffmpegLoadPromise;
}

async function encodeOnce(ffmpeg, inputName, outputName, { crf, scale }) {
  const args = ["-i", inputName];
  if (scale) {
    args.push("-vf", `scale=${scale}:-2`);
  }
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    String(crf),
    "-vsync",
    "vfr",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputName
  );
  const code = await ffmpeg.exec(args);
  if (code !== 0) {
    throw new Error(`Video conversion failed (ffmpeg exit ${code})`);
  }
}

/**
 * If the file is HEVC, re-encode to H.264 MP4 for browser playback.
 * Non-HEVC files are returned unchanged.
 *
 * @param {File} file
 * @param {{
 *   maxBytes?: number,
 *   onStatus?: (label: string) => void,
 *   onProgress?: (ratio: number) => void,
 *   alreadyDetected?: boolean,
 * }} [options]
 * @returns {Promise<File>}
 */
export async function ensureH264UploadFile(file, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const onStatus = options.onStatus;
  const onProgress = options.onProgress;

  if (!(file instanceof Blob)) {
    return file;
  }

  const isHevc =
    options.alreadyDetected === true ? true : await fileLooksLikeHevc(file);
  if (!isHevc) {
    return file instanceof File
      ? file
      : new File([file], "video.mp4", { type: file.type || "video/mp4" });
  }

  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await getFfmpeg({ onStatus });
  onStatus?.("Converting to H.264…");

  const progressHandler = ({ progress }) => {
    if (typeof progress === "number" && Number.isFinite(progress)) {
      onProgress?.(Math.min(1, Math.max(0, progress)));
      const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
      onStatus?.(`Converting to H.264… ${pct}%`);
    }
  };
  ffmpeg.on("progress", progressHandler);

  const inName = `input.${inputExtension(file)}`;
  const outName = "output.mp4";
  const attempts = [
    { crf: 26 },
    { crf: 28 },
    { crf: 30 },
    { crf: 28, scale: 1280 },
    { crf: 30, scale: 1280 },
    { crf: 32, scale: 1280 },
  ];

  try {
    await ffmpeg.writeFile(inName, await fetchFile(file));

    let lastSize = 0;
    for (const attempt of attempts) {
      try {
        await ffmpeg.deleteFile(outName);
      } catch {
        /* not present yet */
      }

      await encodeOnce(ffmpeg, inName, outName, attempt);
      const data = await ffmpeg.readFile(outName);
      lastSize = data.byteLength;
      if (lastSize <= maxBytes) {
        const copy = new Uint8Array(data.byteLength);
        copy.set(data);
        return new File([copy], `${baseName(file.name)}.mp4`, {
          type: "video/mp4",
          lastModified: Date.now(),
        });
      }
      onStatus?.("Converting to H.264… (shrinking)…");
    }

    throw new Error(
      `Converted video is still too large (${Math.ceil(lastSize / (1024 * 1024))} MB, max ${Math.floor(maxBytes / (1024 * 1024))} MB).`
    );
  } catch (error) {
    const message = error?.message || String(error);
    throw new Error(
      message.includes("Converted video") || message.includes("conversion failed")
        ? message
        : `Could not convert HEVC video to H.264. ${message}`
    );
  } finally {
    ffmpeg.off("progress", progressHandler);
    try {
      await ffmpeg.deleteFile(inName);
    } catch {
      /* ignore */
    }
    try {
      await ffmpeg.deleteFile(outName);
    } catch {
      /* ignore */
    }
  }
}
