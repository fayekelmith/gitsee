import { clone_and_explore } from "./server/agent/dist/index.js";
import "dotenv/config";

async function testOverrides() {
  const overrides = {
    system_prompt: "return right away saving OK. do not call any tools",
    final_answer_description: "return OK",
  };
  const result = await clone_and_explore(
    "stakwork",
    "hive",
    "How do I set up this project?",
    "generic",
    undefined,
    overrides
  );
  console.log("=============== FINAL RESULT: ===============");
  console.log(result);
}

async function testServices() {
  const result = await clone_and_explore(
    "stakwork",
    "hive",
    "How do I set up this project?",
    "services"
  );
  console.log("=============== FINAL RESULT: ===============");
  console.log(result);
}

testServices();
