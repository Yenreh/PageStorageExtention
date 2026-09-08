# Store listing

Copy-paste text for the Chrome Web Store and addons.mozilla.org submissions.

## Short description (132 characters max)

Inspect, copy, edit and clear cookies, localStorage and sessionStorage. Only on the sites you enable.

## Description

Page Storage lets you work with the storage of the site you are developing
without opening DevTools:

- Lists the cookies, local storage and session storage of the current origin
- Search box that filters by key, value or domain across the three sections
- Copy the full value of any entry to the clipboard
- Edit values in place, both cookies and local/session storage
- Delete a single entry, a whole section, or everything at once
- Per-site switch: the extension only reads and clears where you enable it
- Reload button to see the page with clean storage
- English and Spanish interface, light and dark mode

The extension does not collect, store or transmit any personal data. Everything
stays in your browser.

## Single purpose

Page Storage lets a web developer inspect, copy, edit and clear the cookies,
localStorage and sessionStorage of the sites they explicitly enable, without
opening DevTools.

## Permission justifications

**tabs**
Read the URL of the active tab so the extension knows which origin the cookies
and storage belong to, and reload that tab when the user presses Reload.

**activeTab**
Read the URL and identity of the tab the user is looking at when the popup is
opened.

**scripting**
Read and modify the page's localStorage and sessionStorage from the popup. It
runs only on origins the user has enabled with the toggle in the popup.

**cookies**
List, edit and delete the cookies of the site the user enabled, from the popup.
Cookies are only read and modified locally and are never transmitted.

**Host permission (<all_urls>)**
The user decides which sites to manage, so the hosts cannot be known in advance.
Despite the broad declaration, the extension only reads or modifies the origins
the user enabled with the toggle; no other site is accessed.

**storage**
Store locally which origins the user enabled. No data leaves the browser.

**Remote code**
No, I am not using remote code. All HTML, CSS and JavaScript is included in the
package.

## Data usage

No user data is collected, stored or transmitted. The extension makes no network
requests.
