const express = require("express")
const axios = require("axios")
const cron = require("node-cron")
const multer = require("multer")
const FormData = require("form-data")
var cronJobs = require("./user")
const upload = multer()
const cors = require("cors")
const app = express()
const port = 3002

app.use(cors())

let chatApiResponse = ""
let maxId = 0

const chatApiUrl = "https://balanced-wren-relaxing.ngrok-free.app/chat"
const submitApiUrl = "http://sudu.ai:3000/submit"

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
async function sendResponse(message, contactNum) {
  try {
    const form = new FormData()
    form.append("contact_num", contactNum)
    form.append("msg", message)

    const response = await axios.post(submitApiUrl, form, {
      headers: {
        ...form.getHeaders(),
        accept: "/",
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

// Set up Express to serve HTML form
app.use(express.json())
app.use(upload.none())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html")
})

app.get("/all", (req, res) => {
  const newCronJobs = cronJobs.map(({ job, ...rest }) => rest)
  res.send(newCronJobs)
})

app.post("/trigger-api", (req, res) => {
  const {
    question,
    database_name,
    cron_input,
    second_function,
    contact_num,
    company_id,
    question_name,
    use_case,
    sub_use_case,
  } = req.body

  const requiredFields = [
    "question",
    "database_name",
    "cron_input",
    "second_function",
    "contact_num",
    "company_id",
    "question_name",
    "use_case",
    "sub_use_case",
  ]

  for (const field of requiredFields) {
    if (!req.body[field]) {
      console.log(`${field} is required`)
      return res.status(400).send(`${field} is required`) // Send 400 Bad Request response
    }
  }

  const contactNumRegex = /^60\d{9,10}$/
  if (!contactNumRegex.test(contact_num)) {
    console.log("Invalid phone number format")
    return res.send("Invalid phone number format")
  }

  if (cron_input.toLowerCase() === "stop") {
    // Stop all existing cron jobs
    Object.values(cronJobs).forEach((jobEntry) => {
      jobEntry.job.stop()
    })

    console.log("All cron jobs stopped.")
    cronJobs = [] // Clear the cron jobs object
    res.redirect("/")
    return
  }

  const newCronSchedules = cron_input.split(",")
  console.log("This is new cron shceduler", newCronSchedules)

  newCronSchedules.forEach((schedule) => {
    const newCronJob = cron.schedule(schedule, async () => {
      console.log("===============================")
      console.log("Scheduled task started.")
      console.log("Use Case:", question)
      console.log("Cron Input:", schedule)
      console.log("Sec Function:", second_function)
      console.log("Contact Number:", contact_num)
      console.log(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" })
      )
      console.log("===============================")

      // Make both API calls
      chatApiResponse = await sendChatMessage(question, database_name)
      const response = await sendResponse(chatApiResponse, contact_num)

      console.log("Chat API Response:", chatApiResponse)
    })

    console.log(`New cron job scheduled: ${schedule}`)

    let cronJobId

    if (cronJobs.length < 0) {
      maxId += 1
      cronJobId = maxId
    } else {
      for (const cronJob of cronJobs) {
        if (cronJob.id > maxId) {
          maxId = cronJob.id
        }
      }
      cronJobId = maxId + 1
    }

    const newCron = {
      id: cronJobId,
      company_id: company_id,
      cron_input: schedule,
      question: question,
      contact_number: contact_num,
      secFunction: second_function,
      job: newCronJob,
      question_name: question_name,
      use_case: use_case,
      sub_use_case: sub_use_case,
    }

    cronJobs.push(newCron)
    console.log(cronJobs.map(({ job, ...rest }) => rest))
  })

  res.send("Scheduler successfully created")
})

app.patch("/update", (req, res) => {
  const {
    id,
    cron_input,
    question,
    contact_num,
    company_id,
    question_name,
    use_case,
    sub_use_case,
  } = req.body

  const requiredFields = [
    "id",
    "question",
    "cron_input",
    "contact_num",
    "company_id",
    "question_name",
    "use_case",
    "sub_use_case",
  ]

  for (const field of requiredFields) {
    if (!req.body[field]) {
      console.log(`${field} is required`)
      return res.send(`${field} is required`)
    }
  }

  const contactNumRegex = /^60\d{9,10}$/
  if (!contactNumRegex.test(contact_num)) {
    console.log("Invalid phone number format")
    return res.send("Invalid phone number format")
  }

  const indexToUpdate = cronJobs.findIndex((data) => data.id === parseInt(id))
  const jobToUpdate = cronJobs[indexToUpdate]

  if (indexToUpdate !== -1) {
    // Stop the specific job
    jobToUpdate.job.stop()

    // Update cron_input property
    jobToUpdate.cron_input = cron_input
    jobToUpdate.question = question
    jobToUpdate.contact_number = contact_num
    jobToUpdate.company_id = company_id
    jobToUpdate.question_name = question_name
    jobToUpdate.use_case = use_case
    jobToUpdate.sub_use_case = sub_use_case

    const newCronSchedules = cron_input.split(",")

    newCronSchedules.forEach((schedule) => {
      const newCronJob = cron.schedule(schedule, async () => {
        console.log("===============================")
        console.log("Scheduled task started.")
        console.log("Use Case:", question)
        console.log("Cron Input:", schedule)
        console.log("Company Id:", company_id)
        console.log("Sec Function:", jobToUpdate.secFunction)
        console.log("Contact Number:", contact_num)
        console.log(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" })
        )
        console.log("===============================")

        jobToUpdate.job = newCronJob

        try {
          // Make both API calls
          chatApiResponse = await sendChatMessage(question, "de_carton")
          const response = await sendResponse(chatApiResponse, contact_num)

          console.log("Chat API Response:", chatApiResponse)
        } catch (error) {
          console.error("Error in cron job:", error.message)
        }
        console.log(`New cron job scheduled: ${schedule}`)
      })
    })

    console.log(`The array id ${id} has been updated`)
    return res.send(`The array id ${id} has been updated`)
  } else {
    return res.status(404).send("This id is not found")
  }
})

app.delete("/delete/:id", (req, res) => {
  const id = req.params.id

  // Find the index of the element with the specified id
  const indexToRemove = cronJobs.findIndex((data) => data.id === parseInt(id))

  if (indexToRemove < 0) {
    console.log("The id is not found")
    return res.send("The id not found")
  }

  const jobToRemove = cronJobs[indexToRemove]
  jobToRemove.job.stop()

  if (indexToRemove !== -1) {
    // Remove the element at the found index
    cronJobs.splice(indexToRemove, 1)

    if (id > maxId) {
      maxId = parseInt(id)
    }

    console.log(`The array id ${id} has been deleted`)
    res.send(`The array id ${id} has been deleted`)
  } else {
    res.send("This id is not found")
  }
})

app.listen(port, () => {
  console.log(`Server is running on http://sudu.ai:${port}`)
})
