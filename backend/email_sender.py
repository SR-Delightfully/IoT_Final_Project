import smtplib
from email.message import EmailMessage
from email_credentials import our_email as sender_email, app_password

def send_email(user_email, server_name, temp):
    
    # --- setup ---
    receiver_email = user_email
    emailfile = 'message.txt'
    email_message = f"""Hello,
Your server "{server_name}" is warmer than the set threshold.
The current temperature is {temp}℃.

Would you like to turn on the fan?
If so, then please reply to this message with "YES";
Otherwise, please ignore this message.
\n
Best,
The IoT Team"""

    # Create a sample text file to send (so the script is runnable as-is)
    with open(emailfile, 'w') as f:
        f.write(email_message)

    # Open the plain text file whose name is in textfile for reading.
    with open(emailfile) as fp:
        # Create a text/plain message
        msg = EmailMessage()
        msg.set_content(fp.read())

    # From == the sender's email address
    # To == the recipient's email address
    msg['Subject'] = f'Overheating Server Warning'
    msg['From'] = sender_email
    msg['To'] = receiver_email

    # Send the message via our own SMTP server.
    s = smtplib.SMTP('smtp.gmail.com', 587)
    s.starttls()
    s.login(sender_email, app_password)  # NOT your normal password
    s.send_message(msg)
    s.quit()
    
def main():
    # Pre-configured values for debugging/testing purposes
    send_email(sender_email, "Fridge 1", 10)
    
if __name__ == '__main__':
    main()
