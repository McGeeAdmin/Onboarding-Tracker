# Ramp Trainee Tracker

A web app for ramp trainers to record which tasks each new hire did on each flight, and to see how many times every trainee has done every task.

Trainers sign in with their Microsoft work account. They can use the app on a phone at the gate or on a computer.

---

## What trainers see

The app has two parts. On a phone, they're buttons at the bottom of the screen; on a computer, they're tabs at the top.

**Submit tasks** is the form:

1. The trainer's name is filled in automatically from their sign-in.
2. They pick the trainee by typing part of a name or employee ID. If the trainee isn't on the list yet, the trainer can add them right there.
3. Week 1 or 2 is filled in from the trainee's record, and the trainer can change it.
4. They choose **Arrival (In)** or **Departure (Out)**. Only that part of the turn's tasks are shown.
5. They enter the gate, flight number and tail number.
6. They tap every task the trainee did. Each task button shows how many times this trainee has done it so far.
7. They add notes if needed and submit.

"Submit and add another trainee on this flight" keeps the flight details filled in for the next trainee on the same turn.

**View submissions** has three views. A switch at the top shows everyone's trainees or only the trainer's own.

- **By trainee:** one trainee's count for every task and when each was last done. Tapping a task lists every time it was done.
- **All submissions:** a feed of submissions, newest first, with filters and a CSV download.
- **Progress grid:** every trainee as a row and every task as a column, with counts in each cell.

---

## How it's built

| Folder | Azure service | Purpose |
|---|---|---|
| `src/` | Azure Static Web Apps | The web page (`index.html`) and sign-in settings (`staticwebapp.config.json`) |
| `api/` | Azure Functions, run by Static Web Apps | Reads and saves data, and checks who is signed in |
| `database/` | Azure SQL Database | `schema.sql` creates the two tables |
| — | Microsoft Entra ID | Company sign-in. Only accounts in your tenant can get in |

### The database

**Employees** holds one row per trainee.

| Column | Meaning |
|---|---|
| `EmployeeId` | The trainee's employee ID (the key) |
| `FirstName`, `LastName` | Trainee's name |
| `Active` | 1 = in training. 0 = hidden from lists after they finish or leave; their history is kept |
| `CreatedBy`, `CreatedAt` | Who added the trainee, and when |

**TaskLog** holds one row per task done. If a trainer ticks three tasks in one submission, that saves three rows.

| Column | Meaning |
|---|---|
| `Id` | Row number |
| `EntryGroupId` | Shared by all rows saved in the same submission, so a submission can be shown or deleted as one |
| `LogDate` | Date the task was done |
| `EmployeeId` | Which trainee |
| `TaskCode` | Which task (the codes are listed in `api/src/taskList.js`) |
| `Phase` | `IN` = arrival, `OUT` = departure |
| `Week` | Training week, 1 or 2 |
| `Gate`, `Flight`, `Tail` | Flight details. A gate is required, plus a flight or tail number |
| `Notes` | Optional trainer notes |
| `TrainerEmail`, `TrainerName` | Who logged it, taken from their sign-in |
| `CreatedAt` | When it was saved |

---

## Setup

This is a one-time job of about an hour. You need access to create resources in your Azure subscription and to register an app in Entra ID. Your IT or cloud team can do those parts if you don't have that access.

### Step 1: Create the database

1. In the Azure portal, create an **Azure SQL Database** named `ramptracker`. The **serverless** compute tier is plenty for this app.
2. On the SQL server's **Networking** page, turn on **Allow Azure services and resources to access this server**.
3. Open the database and go to **Query editor**. Sign in, paste all of `database/schema.sql`, and click **Run**. You should see two new tables, `Employees` and `TaskLog`.
4. Open **Connection strings**, copy the **ADO.NET** string, and put your SQL password in place of `{your_password}`. Save it for Step 5.

### Step 2: Put the code in a repository

Create a new GitHub or Azure DevOps repository and push this whole folder to it. From then on, every push updates the live site automatically.

### Step 3: Create the Static Web App

1. In the Azure portal, create a **Static Web App**.
2. For **Plan type**, choose **Standard**. The Free plan can't restrict sign-in to your company's accounts.
3. Connect it to your repository and branch.
4. Under **Build details**, set **App location** to `src` and **Api location** to `api`. Leave **Output location** blank.
5. Click **Create**. When it finishes, copy the site URL from the Overview page (it looks like `https://nice-sand-123.azurestaticapps.net`).

### Step 4: Set up company sign-in

1. Go to **Microsoft Entra ID → App registrations → New registration**.
   - **Name:** Ramp Trainee Tracker
   - **Supported account types:** Accounts in this organizational directory only
   - **Redirect URI:** choose *Web* and enter `https://YOUR-SITE-URL/.auth/login/aad/callback`
2. Open **Authentication** and tick **ID tokens**, then save.
3. Open **Certificates & secrets** and create a **New client secret**. Copy the secret's **Value** right away, because it's only shown once.
4. From the **Overview** page, copy the **Application (client) ID** and the **Directory (tenant) ID**.
5. In `src/staticwebapp.config.json`, replace `YOUR-TENANT-ID` with your Directory (tenant) ID. Commit and push.

### Step 5: Add the settings

In the Static Web App, open **Settings → Environment variables** and add these four:

| Name | Value |
|---|---|
| `SQL_CONNECTION_STRING` | The connection string from Step 1 |
| `AZURE_CLIENT_ID` | Application (client) ID from Step 4 |
| `AZURE_CLIENT_SECRET` | Client secret value from Step 4 |
| `ADMIN_EMAILS` | Supervisors' work emails, separated by commas |

Click **Apply**, then open the site URL. You should be sent to the Microsoft sign-in page, then into the app.

### Step 6 (optional): Limit who can open it

As set up so far, anyone in your company can sign in. To allow only trainers and supervisors:

1. Go to **Entra ID → Enterprise applications** and open Ramp Trainee Tracker.
2. Under **Properties**, set **Assignment required** to **Yes**.
3. Under **Users and groups**, add the people or groups who should have access.

---

## Who can do what

| | Trainers | Supervisors (listed in `ADMIN_EMAILS`) |
|---|---|---|
| Submit tasks and add new trainees | ✓ | ✓ |
| See all trainees and all submissions | ✓ | ✓ |
| Delete their own submissions | ✓ | ✓ |
| Delete anyone's submission | | ✓ |
| Fix a trainee's name, or hide a trainee who has finished | | ✓ |

To add or remove a supervisor, edit `ADMIN_EMAILS` in the Static Web App's environment variables.

---

## Changing the task list

The tasks are listed in `api/src/taskList.js`, under Arrival and Departure, in the order they appear on the form. After you edit the file and push, the site updates in a few minutes.

- **Add a task:** add a line in the right section with a new code that isn't used anywhere else, for example:
  `{ code: 'fuel_check', label: 'Fuel check', phase: 'OUT' },`
- **Rename a task:** change only its `label`. Past entries show the new name automatically.
- **Retire a task:** add `hidden: true` to its line. Don't delete the line, because saved entries still use its code.
- **Never change a task's `code`** once anything has been logged with it.

---

## Common problems

| What you see | What to check |
|---|---|
| The sign-in page says the redirect URI doesn't match | The redirect URI from Step 4 must match your site URL exactly and end in `/.auth/login/aad/callback` |
| Signed in, but the page says "The server could not complete that request" | `SQL_CONNECTION_STRING` is wrong or missing its password, or the Networking setting from Step 1 isn't turned on |
| No Delete or Edit buttons for a supervisor | Their email in `ADMIN_EMAILS` must match their sign-in email exactly |
| Changes you pushed don't show up | In the repository, check the latest run under GitHub **Actions** or Azure DevOps **Pipelines** for an error |

---

## Reports and exports

- **CSV:** in View submissions, open **All submissions**, set the filters you want, and click **Download as CSV**. The file opens in Excel.
- **Power BI or Excel live connection:** use *Get Data → Azure SQL Database* and point it at the `ramptracker` database. `TaskLog` has one row per task, which makes counts easy to build.

---

## Running it on your own computer (optional, for developers)

1. Install Node.js 20, Azure Functions Core Tools v4, and the Static Web Apps CLI (`npm install -g @azure/static-web-apps-cli`).
2. Copy `api/local.settings.example.json` to `api/local.settings.json` and fill in a SQL connection string.
3. Run `cd api && npm install && cd ..`
4. Run `swa start src --api-location api` and open http://localhost:4280.

The CLI shows a practice sign-in page where you can type any email. Use one that's listed in `ADMIN_EMAILS` to test the supervisor features.
