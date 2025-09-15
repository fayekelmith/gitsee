import { clone_and_get_context } from "./server/agent/dist/index.js";
import "dotenv/config";

setTimeout(async () => {
  clone_and_get_context(
    "stakwork",
    "hive",
    "How do I set up this project?",
    "services"
  ).then((result) => {
    console.log("=============== FINAL RESULT: ===============");
    console.log(result);
  });
});
