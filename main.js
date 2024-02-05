const express = require("express")
const axios = require("axios")
const cron = require("node-cron")
const multer = require("multer")
const FormData = require("form-data")
var userData = require("./user")

const app = express()
const port = 3002

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

let cronInput
let secFunc
let contactNum
let cronJobs = {}

// Define the API endpoints you want to call
const chatApiUrl = "http://192.168.1.50:9085/chat"
const submitApiUrl = "http://host.docker.internal:3000/submit"

// Define a function to make the chat API call
async function sendChatMessage(message, databaseName) {
  try {
    const response = await axios.post(chatApiUrl, null, {
      params: {
        msg: message,
        database_name: databaseName,
      },
      headers: {
        Accept: "application/json",
      },
    })

    console.log(response.data.message)
    return response.data.result
  } catch (error) {
    console.error("Error calling Chat API:", error.message)
    throw error
  }
}

// Define a function to make the submit API call
async function sendResponse(message, contactNum, imgBuffer) {
  try {
    const form = new FormData()
    form.append("contact_num", contactNum)
    form.append("msg", message)

    const response = await axios.post(submitApiUrl, form, {
      headers: {
        ...form.getHeaders(),
        accept: "*/*",
        "Content-Type": "multipart/form-data",
      },
    })

    console.log(String(response.data))
    return response
  } catch (error) {
    console.error("Error in sendResponse:", error.message)
    throw error
  }
}

app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))
app.use(upload.single("img"))

app.get("/all", (req, res) => {
  res.send(userData)
})

app.post("/trigger-api", (req, res) => {
  cronInput = req.body.cronInput
  const message = req.body.message
  const databaseName = req.body.databaseName
  secFunc = req.body.secFunc
  contactNum = req.body.contactNum
  const imgBuffer = req.file ? req.file.buffer : undefined

  if (!message && !imgBuffer) {
    return res
      .status(400)
      .json({ message: "Must atleast insert message or image" })
  }

  if (cronInput.toLowerCase() === "stop") {
    Object.values(cronJobs).forEach((jobEntry) => {
      jobEntry.job.stop()
    })

    console.log("All cron jobs stopped.")
    cronJobs = {}
    res.redirect("/")
    return
  }

  const newCronSchedules = cronInput.split(",")

  newCronSchedules.forEach((schedule) => {
    const newCronJob = cron.schedule(schedule, async () => {
      console.log("===============================")
      console.log("Scheduled task started.")
      console.log("Use Case:", message)
      console.log("Cron Input:", schedule)
      console.log("Sec Function:", secFunc)
      console.log("Contact Number:", contactNum)
      console.log("Image:", imgBuffer)
      console.log(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" })
      )
      console.log("===============================")

      try {
        const chatApiResponse = await sendChatMessage(message, databaseName)
        const response = await sendResponse(
          chatApiResponse,
          contactNum,
          imgBuffer
        )

        const newData = {
          id: userData.length + 1,
          cron_input: schedule,
          chat_api_response: chatApiResponse,
          contact_number: contactNum,
        }

        userData.push(newData)
        console.log(userData)
        console.log("Chat API Response:", chatApiResponse)
      } catch (error) {
        console.error("Error in cron job:", error.message)
      }
    })

    console.log(`New cron job scheduled: ${schedule}`)

    cronJobs[schedule] = {
      cronInput: schedule,
      secFunction: secFunc,
      contactNumber: contactNum,
      img: imgBuffer,
      job: newCronJob,
    }
  })

  res.redirect("/")
})

app.patch("/update", (req, res) => {
  res.send("This is update")
})

app.delete("/delete", (req, res) => {
  res.send("This is delete")
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
