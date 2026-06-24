# Job Application Autofill

A lightweight Chrome extension for saving reusable job application details and filling common application fields with one click.

## Why I Created This

I built this project because filling out job applications repeatedly is tedious, but many existing tools are more than I need.

There are free autofill and job application tools available, but I wanted a workflow that fits how I personally apply. I did not want to upload my personal information to another company, create an account with a third-party service, or depend on features I do not need, such as AI job matching or application scoring.

This extension is intentionally simple and direct. It stores my reusable application details, helps fill common fields, lets me copy frequently used resume information, and keeps the workflow under my control.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the project folder containing `manifest.json`.

## Use it

1. Open the extension popup.
2. Enter your reusable profile details.
3. Click **Save**.
4. On a job application page, open the popup and click **Fill Page**.
5. Click **Clear** to undo fields filled by the extension during the current page session.

The extension stores your profile in this browser's local Chrome extension storage. It only fills fields when you click the button.

Click visible profile, resume, link, education, work, skill, or language text in the popup to copy that text to your clipboard.

## Privacy

Your saved profile details are stored in your own Chrome extension storage. They are not hardcoded into this repository and are not sent to an external server.

Read the full privacy statement in [PRIVACY.md](PRIVACY.md).

## Repository Safety

Do not commit personal profile details, resumes, local machine paths, screenshots with private information, or real job application data to this repository. Keep examples generic and use placeholder values.

## Custom Answers

Use custom answers for fields that vary by site but repeat for you, such as salary expectations or notice period. Add the form label text in **Field text** and the value you want inserted in **Answer**.

## Education and Work

Upload a PDF or DOCX resume in **Resume source**. The extension extracts the resume text locally in your browser and saves the extracted text until you delete the resume. The **Education** and **Work** sections update from that resume text automatically and fill repeated school, degree, employer, title, date, location, and description fields in page order when a job application has matching sections.

Country is intentionally not included in the saved profile fields.

## Links, Skills, and Languages

Add links in the profile editor or upload a resume with **Skills** and **Languages** headings. The popup shows links as rows and skills/languages as compact chips. Skills and languages only autofill matching application fields when those fields are required.
