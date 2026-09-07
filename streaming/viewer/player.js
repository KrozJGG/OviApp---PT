const video = document.getElementById("video");
const streamUrl = "http://localhost:8888/rebano/index.m3u8";

if (window.Hls) {
  const hls = new Hls();
  hls.loadSource(streamUrl);
  hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
  video.src = streamUrl;
  video.play();
} else {
  alert("Tu navegador no soporta HLS.");
}
