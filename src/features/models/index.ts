import { registerView } from "@/lib/view-registry";
import ModelBrowser from "./ModelBrowser";

export default ModelBrowser;

registerView("model-browser", ModelBrowser);
