import { get_context } from "./dist/agent/index.js";
import "dotenv/config";

setTimeout(() => {
  get_context(
    "How do I set up this project?",
    "/Users/evanfeenstra/code/sphinx2/hive",
    "services"
  ).then((result) => {
    console.log("=============== FINAL RESULT: ===============");
    console.log(result);
  });
});
