// Configuracion de Remotion CLI (Studio / render por CLI).
// El pipeline programatico (scripts/render.ts) usa @remotion/bundler + @remotion/renderer
// y pasa sus propias opciones; este archivo solo afecta a `npx remotion ...`.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
