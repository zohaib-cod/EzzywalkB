import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { prisma } from '../prismaClient.js';

const ADMIN_EMAILS = [
  'ezzywalk.sliper@gmail.com',
  'alizohaib.web@gmail.com'
];

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ezzywalk.sliper@gmail.com',
    pass: 'axuy jerd czwu ecnr'
  }
});

webpush.setVapidDetails(
  'mailto:ezzywalk.sliper@gmail.com',
  'BNtJZSs_se0Cznlkki9xW0ouqY-Mm6_RlMS2QzN6d8AVd6LhoU6utDHd12YzvKsd4ZrKumH3bL7DFpE0E4kzfw0',
  'TrpM0Bpty7WQRCEVnQHy62q8y0svaf8olzHFnkcBM7Y'
);

export const sendAdminEmail = async (subject, htmlBody) => {
  try {
    await transporter.sendMail({
      from: '"Ezzywalk Admin" <ezzywalk.sliper@gmail.com>',
      to: ADMIN_EMAILS.join(', '),
      subject,
      html: htmlBody
    });
    console.log(`[Notifier] Email sent: ${subject}`);
  } catch (error) {
    console.error('[Notifier] Failed to send email:', error);
  }
};

export const sendPushToAdmins = async (payload) => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { user: { role: 'ADMIN', isBlocked: false } }
    });
    const masterSubscriptions = await prisma.pushSubscription.findMany({
      where: { user: { role: 'MASTER_ADMIN', isBlocked: false } }
    });

    const allSubs = [...subscriptions, ...masterSubscriptions];
    if (!allSubs.length) return;

    const pushPayload = JSON.stringify(payload);
    
    await Promise.all(allSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys
          },
          pushPayload
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is no longer valid
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          console.error('[Notifier] Push notification error:', err);
        }
      }
    }));
    console.log(`[Notifier] Push notification sent to ${allSubs.length} admins.`);
  } catch (error) {
    console.error('[Notifier] Push error:', error);
  }
};

export const notifyAdminEvent = async (type, details) => {
  let subject = '';
  let html = '';
  let pushMessage = '';

  switch (type) {
    case 'ORDER':
      subject = `New Order Placed - Rs ${details.totalAmount}`;
      html = `<p>A new order has been placed.</p><p>Total: Rs ${details.totalAmount}</p><p>Order ID: ${details.id}</p>`;
      pushMessage = `New Order Placed! Total: Rs ${details.totalAmount}`;
      break;
    case 'PRODUCT':
      subject = `New Product Uploaded - ${details.name}`;
      html = `<p>A new product <b>${details.name}</b> has been uploaded to the store.</p>`;
      pushMessage = `Product Uploaded: ${details.name}`;
      break;
    case 'BANNER':
      subject = `New Banner Uploaded`;
      html = `<p>A new banner <b>${details.title}</b> has been added.</p>`;
      pushMessage = `New Banner Added!`;
      break;
    case 'OTP':
      subject = `Admin Registration OTP`;
      html = `<p>Someone is trying to register as an admin.</p><p>The OTP is: <b>${details.code}</b></p><p>Provide this code to them if authorized.</p>`;
      break;
    case 'ADMIN_INVITE':
      subject = `You are invited to be an Admin at Ezzywalk`;
      html = `<p>You have been invited to become a Co-Admin.</p><p>Click the link below to accept the invitation and set up your account:</p><p><a href="${details.link}">${details.link}</a></p>`;
      break;
    case 'PASSWORD_RESET':
      subject = `Password Reset OTP`;
      html = `<p>Your password reset code is: <b>${details.code}</b></p>`;
      break;
  }

  // Send Email
  if (type === 'ADMIN_INVITE' || type === 'PASSWORD_RESET') {
    // Send to specific user email instead of all admins
    try {
      await transporter.sendMail({
        from: '"Ezzywalk Admin" <ezzywalk.sliper@gmail.com>',
        to: details.email,
        subject,
        html
      });
    } catch (e) { console.error('Failed to send specific email', e); }
    return; // Don't send push for these personal emails
  } else {
    await sendAdminEmail(subject, html);
  }

  // Send Push Notification (Except for OTPs)
  if (type !== 'OTP') {
    await sendPushToAdmins({
      title: 'Ezzywalk Admin',
      body: pushMessage,
      url: '/admin'
    });
  }
};
