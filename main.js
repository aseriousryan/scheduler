const express = require("express");
const axios = require("axios");
const cron = require("node-cron");
const multer = require("multer");
const FormData = require("form-data");
var cronJobs = require("./user");
const upload = multer();

const app = express();
const port = 5000;

let chatApiResponse = "";

// Define the API endpoints you want to call
const chatApiUrl = "http://192.168.1.50:9085/chat";
const submitApiUrl = "http://localhost:3000/submit";

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
		});

		console.log(response.data.message);
		return response.data.result;
	} catch (error) {
		console.error("Error calling Chat API:", error.message);
		throw error;
	}
}

// Define a function to make the submit API call
async function sendResponse(message, contactNum) {
	try {
		const form = new FormData();
		form.append("contact_num", contactNum);
		form.append("msg", message);

		const response = await axios.post(submitApiUrl, form, {
			headers: {
				...form.getHeaders(),
				accept: "/",
				"Content-Type": "multipart/form-data",
			},
		});

		console.log(String(response.data));
		return response;
	} catch (error) {
		console.error("Error in sendResponse:", error.message);
		throw error;
	}
}

// Set up Express to serve HTML form
app.use(express.json());
app.use(upload.none()); // Parse only form-data without files
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/public/index.html");
});

app.get("/all", (req, res) => {
	const newCronJobs = cronJobs.map(({ job, ...rest }) => rest);

	res.send(newCronJobs);
});

//todo: fix newCronJobs/ plus question so answer takyah laa
app.post("/trigger-api", (req, res) => {
	const { question, database_name, cron_input, second_function, contact_num, company_id } = req.body;

	if (cron_input.toLowerCase() === "stop") {
		// Stop all existing cron jobs
		Object.values(cronJobs).forEach((jobEntry) => {
			jobEntry.job.stop();
		});

		console.log("All cron jobs stopped.");
		cronJobs = []; // Clear the cron jobs object
		res.redirect("/");
		return;
	}

	const newCronSchedules = cron_input.split(",");
	console.log("This is new cron shceduler", newCronSchedules);

	newCronSchedules.forEach((schedule) => {
		const newCronJob = cron.schedule(schedule, async () => {
			console.log("===============================");
			console.log("Scheduled task started.");
			console.log("Use Case:", question);
			console.log("Cron Input:", schedule);
			console.log("Sec Function:", second_function);
			console.log("Contact Number:", contact_num);
			console.log(new Date().toLocaleString("en-US", { timeZone: "example/somwhere" }));
			console.log("===============================");

			// Make both API calls
			chatApiResponse = await sendChatMessage(question, database_name);
			const response = await sendResponse(chatApiResponse, contact_num);

			console.log("Chat API Response:", chatApiResponse);
		});

		console.log(`New cron job scheduled: ${schedule}`);

		const newCron = {
			id: cronJobs.length + 1,
			company_id: company_id,
			cron_input: schedule,
			question: question,
			contact_number: contact_num,
			secFunction: second_function,
			job: newCronJob,
		};

		cronJobs.push(newCron);
		console.log(cronJobs.map(({ job, ...rest }) => rest));
	});

	res.redirect("/");
});

app.patch("/update", (req, res) => {
	const { id, cron_input, question, contact_num, company_id } = req.body;

	const indexToUpdate = cronJobs.findIndex((data) => data.id === parseInt(id));
	const jobToUpdate = cronJobs[indexToUpdate];

	if (indexToUpdate !== -1) {
		// Stop the specific job
		jobToUpdate.job.stop();

		// Update cron_input property
		jobToUpdate.cron_input = cron_input;
		jobToUpdate.question = question;
		jobToUpdate.contact_number = contact_num;
		jobToUpdate.company_id = company_id;

		const newCronSchedules = cron_input.split(",");

		newCronSchedules.forEach((schedule) => {
			const newCronJob = cron.schedule(schedule, async () => {
				console.log("===============================");
				console.log("Scheduled task started.");
				console.log("Use Case:", question);
				console.log("Cron Input:", schedule);
				console.log("Company Id:", company_id);
				console.log("Sec Function:", jobToUpdate.secFunc);
				console.log("Contact Number:", contact_num);
				console.log(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
				console.log("===============================");

				//change old job to new job
				jobToUpdate.job = newCronJob;

				try {
					// Make both API calls
					chatApiResponse = await sendChatMessage(question, "de_carton");
					const response = await sendResponse(chatApiResponse, contact_num);

					console.log("Chat API Response:", chatApiResponse);
				} catch (error) {
					console.error("Error in cron job:", error.message);
				}
				console.log(`New cron job scheduled: ${schedule}`);
			});
		});

		console.log(`The array id ${id} has been updated`);
		return res.send(`The array id ${id} has been updated`);
	} else {
		return res.status(404).send("This id is not found");
	}
});

app.delete("/delete/:id", (req, res) => {
	const id = req.params.id;

	// Find the index of the element with the specified id
	const indexToRemove = cronJobs.findIndex((data) => data.id === parseInt(id));
	const jobToRemove = cronJobs[indexToRemove];
	jobToRemove.job.stop();

	if (indexToRemove !== -1) {
		// Remove the element at the found index
		cronJobs.splice(indexToRemove, 1);

		console.log(`The array id ${id} has been deleted`);
		res.send(`The array id ${id} has been deleted`);
	} else {
		res.send("This id is not found");
	}
});

// Start the Express server
app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});