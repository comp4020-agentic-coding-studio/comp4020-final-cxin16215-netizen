# Using rules and checks together for coding agents

When a coding agent makes a mistake, I can add a rule to CLAUDE.md or
AGENTS.md, or add a test or CI check. Böckeler (2026) calls these “guides”
and “sensors”: one tells the agent how to work, and the other checks the
result.

I would use both: rules help the agent follow the project’s requirements,
and checks catch specific problems before the code is deployed. For an
important requirement, I want the agent to understand it and have a separate
check to enforce it.

## Rules help with everyday work

Rules have worked well in my own project. I handed most of the development
to an agent during the semester and rarely saw it ignore a rule. Hashimoto
(2026) describes a similar experience: he added a line to AGENTS.md for each
bad behaviour he saw, and says this “almost completely resolved them all”.

That makes a rule a useful first step: it is quick to write, gives the agent
guidance it can use across different tasks, and gives me a place to explain
why a requirement matters.

Anthropic (2026) describes CLAUDE.md as a non-deterministic guideline that
Claude may decide does not apply, so they recommend hooks,
deny rules, or managed settings when something has to happen every time.
Anthropic sells Claude Code, so I treat this as the vendor’s advice.

Gloaguen et al. (2026) also give a reason to be selective about context
files. Their study found that these files did not generally improve task
success rates and increased costs by over 20% on average, for
developer-written and generated files alike. My experience with rules has
been positive, but adding more instructions clearly has a cost. A line aimed
at one mistake I have seen is a different thing from a long context file.

## Checks need clear requirements and controlled access

The strongest objection to relying on checks is that agents can game them.
In ImpossibleBench, where
the tests conflict with the specification, GPT-5 still passed 54% of the
tasks, by methods that included modifying the tests (Zhong et al., 2025). A passing result means little if the agent can change what counts as
passing.

The same study found that hiding tests reduced successful cheating to near
zero, with read-only tests offering some protection. This makes access
control part of the check: the agent can work on the implementation while
the check stays under separate control.

Who defines the expected behaviour matters too. Chen et al. (2026) found
that agent-generated tests relied on print statements more than assertions,
and changing the number of tests had little effect on final outcomes. A test
the agent writes for itself is still the agent judging its own work, so I
read it before I rely on it.

In Jain (2026), checks built from supplied API specifications improved a
cheaper model’s accepted builds from 3 out of 10 to 10 out of 10, measured
against a hidden test suite, though on a single task with two models.

A human still has to decide what the software should do. As Böckeler (2026)
explains, a check can only assess requirements someone has specified.

## How I would use both in my project

In my project, a visitor’s identity cookie lets the server recognise them,
so anyone who obtains it could act as that visitor. Keeping it out of logs
is an important requirement.

The rule is in CLAUDE.md, and a test already fails the deploy if the cookie
appears in server output or stored logs. The agent can read the rule. It
could technically edit the test too, but every change to it shows up in the
commit history I review; making the check read-only to the agent would be
the stronger version.

The rule helps during development by giving the agent a reason to handle
the cookie carefully wherever it works, so the test rarely fails. The test
checks the paths it covers before every deploy, so a mistake the rule misses
does not ship.

For ordinary conventions, I start with a short rule; for requirements with
serious consequences, I add a check and control who can change it. If the
same mistake keeps happening, those failures tell me what the next check
needs to cover.

## References

Anthropic. (2026). Best practices for Claude Code. Claude Code
documentation. https://code.claude.com/docs/en/best-practices (accessed
27 October 2026).

Böckeler, B. (2026, April 2). Harness engineering for coding agent users.
martinfowler.com. https://martinfowler.com/articles/harness-engineering.html

Chen, Z., Sun, Z., Shi, Y., Peng, C., Gu, X., Lo, D., & Jiang, L. (2026).
Rethinking the value of agent-generated tests for LLM-based software
engineering agents. arXiv:2602.07900.

Gloaguen, T., Mündler-Sasahara, N., Müller, M. N., Raychev, V., & Vechev,
M. (2026). Evaluating AGENTS.md: Are repository-level context files helpful
for coding agents? arXiv:2602.11988 (v3).

Hashimoto, M. (2026, February 5). My AI adoption journey.
https://mitchellh.com/writing/my-ai-adoption-journey

Jain, N. (2026, October 13). Are harnesses worth the cost?
martinfowler.com.
https://martinfowler.com/articles/are-harnesses-worth-the-cost.html

Zhong, Z., Raghunathan, A., & Carlini, N. (2025). ImpossibleBench:
Measuring LLMs' propensity of exploiting test cases. arXiv:2510.20270.
