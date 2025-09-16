import { clone_and_explore_parse_files } from "./server/agent/dist/index.js";
import "dotenv/config";

setTimeout(async () => {
  const result = await clone_and_explore_parse_files(
    "stakwork",
    "hive",
    "How do I set up this project?",
    "services"
  );
  console.log("=============== FINAL RESULT: ===============");
  console.log(result);
});
