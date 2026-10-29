# Resume Markdown format

Each resume is one Markdown file in `resumes/`, registered in `resume.config.json`.
The structure below is what the checks expect and what the templates style.

```markdown
# Your Name

555-555-5555 | you@example.com | linkedin.com/in/you | City, ST

Optional summary paragraph. First person is fine here.

## Experience

### Employer
**Job Title** | 10/2020–Present

- Action-verb bullet with a measurable result.

## Skills

JavaScript, Node.js, PostgreSQL

## Education

- Degree — School
```

## Rules of thumb

| Element | Markdown | Becomes |
| --- | --- | --- |
| Your name | `#` (exactly one) | Document title |
| Contact line | First paragraph under the name | Centered contact block |
| Sections | `##` | Word "Heading 1" / HTML `<section>` |
| Entries | `###` + an `**Job Title** \| dates` line | Word "Heading 2" + muted meta line |
| Achievements | `-` bullets | Real Word bullet list |

- Indent wrapped bullet lines by **2 spaces**. Four spaces turns text into a code block.
- Use one date format everywhere (`10/2020` or `Oct 2020`, not both).
- Write URLs as visible text (`linkedin.com/in/you`), not hidden behind a label.
- Styling belongs in `templates/`, never in the resume file. No HTML, tables, or images.

Recognized section names (case-insensitive) are listed in `src/parse.js` under `SECTION_ALIASES`.
