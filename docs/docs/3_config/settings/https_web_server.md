_An HTTPS server can be enabled for the Companion web interfaces should your deployment require it. It is never recommended to expose the Companion interface to the Internet and HTTPS does not provide any additional security for that configuration._

- **HTTPS Web Server**  
  Check to enable the HTTPS web server.

- **HTTPS Port**  
  The port number HTTPS is served on.

- **Certificate Type**  
  Select from "Self Signed" to use the native certificate generator or "External" to link to certificate files on the file system.

  **Common Name (Domain Name)**
  Enter the "Common Name" (typically a domain name or hostname) that the self signed certificate should be issued for.

  **Certificate Expiry Day**
  Select the number of days the self signed certificate should be issued for (365 days is the default)

  **Private Key File (full path)**
  The full file path for an external private key file.

  **Certificate File (full path)**
  The full file path for an external certificate file.

  **Chain File (full path)**
  Option field to provide the full file path for an external chain file.
