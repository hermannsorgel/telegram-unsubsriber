# Privacy Policy for Telegram Unsubcriber

**Effective Date:** 01/06/2026

This Privacy Policy describes how the "Telegram Unsubcriber" Chrome extension ("the Extension") handles your data.

**1. Data Collection and Usage**

The Extension operates entirely locally within your web browser. It does not collect, store, or transmit any user data to any external servers controlled by the developer.

The Extension functions by sending authorized API requests directly to Telegram's servers on your behalf, using the existing session already active in your browser, to perform the actions you explicitly trigger (such as scanning or leaving channels). No data from these requests is intercepted, logged, or sent to the developer or any other third party.

**2. Local Processing**

All actions performed by the Extension (such as scanning your channel list and executing the command to leave channels) happen strictly on your device by interacting directly with the Telegram Web K interface already loaded in your browser.

**3. Data Sharing**

Because the Extension does not collect any data, your data is never shared, sold, or distributed to any third parties.

**4. Permissions**

The Extension requires the following permissions to function:
* **`activeTab` & `scripting`:** Used strictly to inject the local scripts required to interact with the Telegram Web K page you are currently viewing.
* **`storage`:** Used strictly to save local UI states (like preventing user from clicking a button twice) on your physical device.
* **Host Permission (`https://web.telegram.org/*`):** Required to allow the extension to run on the Telegram Web application.

**5. Contact**
If you have any questions or concerns regarding this privacy policy, please open an issue in this GitHub repository.
