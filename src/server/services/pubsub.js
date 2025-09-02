const { PubSub } = require("@google-cloud/pubsub")
require("dotenv").config()

const pubSub = new PubSub({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    project_id: process.env.GOOGLE_PROJECT_ID,
    projectId: process.env.GOOGLE_PROJECT_ID,
  },
  projectId: process.env.GOOGLE_PROJECT_ID,
});
const topicName = process.env.PUBSUB_DESIGN_TOPIC;

async function setup() {
  // 1️⃣ Ensure Topic exists
  let [topics] = await pubSub.getTopics();
  const topicExists = topics.some((t) => t.name.endsWith(topicName));
  if (!topicExists) {
    await pubSub.createTopic(topicName);
    console.log(`[SETUP] Topic "${topicName}" created ✅`);
  } else {
    console.log(`[SETUP] Topic "${topicName}" already exists ✅`);
  }
}

exports.publishJob = async (data) => {
    await setup();
    const messageId = await pubSub.topic(topicName).publishMessage({ data: Buffer.from(JSON.stringify(data)) })
    console.log(`[PUBSUB] Message ${messageId} published.`)
    return messageId
}