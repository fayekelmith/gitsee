import { clone_and_explore } from "./server/agent/dist/index.js";
import "dotenv/config";

setTimeout(async () => {
  const result = await clone_and_explore(
    "stakwork",
    "hive",
    "How do I set up this project?",
    "generic",
    undefined,
    {
      system_prompt: "return right away saving OK. do not call any tools",
      final_answer_description: "return OK",
    }
  );
  console.log("=============== FINAL RESULT: ===============");
  console.log(result);
});
