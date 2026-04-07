import { tool } from "ai";
import { endOfDay, formatISO, startOfDay } from "date-fns";
import { z } from "zod";

const DEMO_MODE = process.env.DEMO_MODE !== "false";

// --- Mock implementations ---------------------------------------------------

function mockGetCalendarEvents() {
  return tool({
    description:
      "Get calendar events for a given date from the user's Google Calendar",
    inputSchema: z.object({
      date: z.coerce.date().describe("The date to get events for"),
    }),
    execute: async ({ date }) => {
      const dateStr = formatISO(date, { representation: "date" });
      return {
        date: dateStr,
        eventsCount: 3,
        events: [
          {
            id: "evt-001",
            summary: "Team standup",
            startTime: `${dateStr}T09:00:00`,
            endTime: `${dateStr}T09:30:00`,
            location: "Zoom",
            attendees: [
              { email: "alice@company.com", name: "Alice Chen" },
              { email: "bob@company.com", name: "Bob Kim" },
            ],
          },
          {
            id: "evt-002",
            summary: "Product review",
            startTime: `${dateStr}T11:00:00`,
            endTime: `${dateStr}T12:00:00`,
            location: "Conference Room B",
            attendees: [{ email: "pm@company.com", name: "Sarah Lee" }],
          },
          {
            id: "evt-003",
            summary: "1:1 with manager",
            startTime: `${dateStr}T14:00:00`,
            endTime: `${dateStr}T14:30:00`,
            location: null,
            attendees: [{ email: "manager@company.com", name: "David Park" }],
          },
        ],
      };
    },
  });
}

function mockCreateCalendarEvent() {
  return tool({
    description: "Create a new event on the user's Google Calendar",
    inputSchema: z.object({
      summary: z.string().describe("Event title"),
      startTime: z.string().describe("ISO start time"),
      endTime: z.string().describe("ISO end time"),
      description: z.string().optional().describe("Event description"),
    }),
    execute: async ({ summary, startTime, endTime }) => {
      return {
        id: `evt-${Date.now()}`,
        summary,
        htmlLink: `https://calendar.google.com/calendar/event?eid=demo_${Date.now()}`,
        startTime,
        endTime,
        created: true,
      };
    },
  });
}

// --- Real implementations (Token Vault + Google APIs) ------------------------

function realGetCalendarEvents() {
  const { google } = require("googleapis");
  const { TokenVaultError } = require("@auth0/ai/interrupts");
  const { getAccessToken, withCalendarRead } = require("../auth0-ai");

  return withCalendarRead(
    tool({
      description:
        "Get calendar events for a given date from the user's Google Calendar",
      inputSchema: z.object({
        date: z.coerce.date().describe("The date to get events for"),
      }),
      execute: async ({ date }: { date: Date }) => {
        const accessToken = await getAccessToken();
        try {
          const calendar = google.calendar("v3");
          const auth = new google.auth.OAuth2();
          auth.setCredentials({ access_token: accessToken });

          const response = await calendar.events.list({
            auth,
            calendarId: "primary",
            timeMin: formatISO(startOfDay(date)),
            timeMax: formatISO(endOfDay(date)),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 20,
          });

          const events = response.data.items || [];
          return {
            date: formatISO(date, { representation: "date" }),
            eventsCount: events.length,
            events: events.map((event: any) => ({
              id: event.id,
              summary: event.summary || "No title",
              startTime: event.start?.dateTime || event.start?.date,
              endTime: event.end?.dateTime || event.end?.date,
              location: event.location,
              attendees:
                event.attendees?.map((a: any) => ({
                  email: a.email,
                  name: a.displayName,
                })) || [],
            })),
          };
        } catch (error: any) {
          if (error?.status === 401) {
            throw new TokenVaultError(
              "Authorization required for Google Calendar."
            );
          }
          throw error;
        }
      },
    })
  );
}

function realCreateCalendarEvent() {
  const { google } = require("googleapis");
  const { TokenVaultError } = require("@auth0/ai/interrupts");
  const { getAccessToken, withCalendarWrite } = require("../auth0-ai");

  return withCalendarWrite(
    tool({
      description: "Create a new event on the user's Google Calendar",
      inputSchema: z.object({
        summary: z.string().describe("Event title"),
        startTime: z.string().describe("ISO start time"),
        endTime: z.string().describe("ISO end time"),
        description: z.string().optional().describe("Event description"),
      }),
      execute: async ({
        summary,
        startTime,
        endTime,
        description,
      }: {
        summary: string;
        startTime: string;
        endTime: string;
        description?: string;
      }) => {
        const accessToken = await getAccessToken();
        try {
          const calendar = google.calendar("v3");
          const auth = new google.auth.OAuth2();
          auth.setCredentials({ access_token: accessToken });

          const response = await calendar.events.insert({
            auth,
            calendarId: "primary",
            requestBody: {
              summary,
              description,
              start: { dateTime: startTime },
              end: { dateTime: endTime },
            },
          });

          return {
            id: response.data.id,
            summary: response.data.summary,
            htmlLink: response.data.htmlLink,
          };
        } catch (error: any) {
          if (error?.status === 401) {
            throw new TokenVaultError(
              "Authorization required for Google Calendar."
            );
          }
          throw error;
        }
      },
    })
  );
}

// --- Exports ----------------------------------------------------------------

export const getCalendarEvents = DEMO_MODE
  ? mockGetCalendarEvents()
  : realGetCalendarEvents();

export const createCalendarEvent = DEMO_MODE
  ? mockCreateCalendarEvent()
  : realCreateCalendarEvent();
