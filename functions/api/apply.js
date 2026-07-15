// POST /api/apply — create a prefilled DocuSeal submission from the
// web application form and return the signing URL.
//
// Required Cloudflare Pages environment variables:
//   DOCUSEAL_URL           e.g. https://sign.kairos56.org
//   DOCUSEAL_API_TOKEN     from DocuSeal → Settings → API
//   DOCUSEAL_TEMPLATE_ID   numeric ID of the Team Application template
//
// IMPORTANT: when building the template in DocuSeal, name each field
// exactly as listed in TEXT_FIELDS / CHECKBOX_FIELDS below so prefill
// maps 1:1. (Field names are set in the DocuSeal template editor.)

const TEXT_FIELDS = [
  'first_name', 'last_name', 'name_tag', 'dob', 'gender', 'role',
  'address', 'city', 'state', 'zip', 'email', 'cell_phone', 'home_phone',
  'drivers_license', 'church_name', 'denomination', 'church_phone',
  'pastor_name', 'pastor_approval', 'emmaus_year', 'date_trained',
  'year_released', 'doc_number', 'visitation_name', 'visitation_relationship',
];

const CHECKBOX_FIELDS = [
  'attended_emmaus', 'reunion_group', 'qualifying_weekend', 'never_served',
  'doc_trained', 'ex_offender', 'on_parole', 'on_visitation',
  'agree_statement', 'agree_manual',
];

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DOCUSEAL_URL || !env.DOCUSEAL_API_TOKEN || !env.DOCUSEAL_TEMPLATE_ID) {
    return json({ error: 'Online signing is not configured yet.' }, 503);
  }

  let form;
  try {
    form = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  if (!form.email || !form.first_name || !form.last_name) {
    return json({ error: 'Name and email are required.' }, 400);
  }

  const fields = [];
  for (const name of TEXT_FIELDS) {
    const value = (form[name] || '').toString().trim();
    if (value) fields.push({ name, default_value: value });
  }
  for (const name of CHECKBOX_FIELDS) {
    // HTML checkboxes submit "on" when checked, absent when not
    fields.push({ name, default_value: form[name] === 'on' || form[name] === true });
  }

  const payload = {
    template_id: Number(env.DOCUSEAL_TEMPLATE_ID),
    send_email: true, // signing-link email as backup if they navigate away
    submitters: [
      {
        role: 'Applicant',
        name: `${form.first_name} ${form.last_name}`.trim(),
        email: form.email.toString().trim(),
        fields,
      },
    ],
  };

  const res = await fetch(`${env.DOCUSEAL_URL}/api/submissions`, {
    method: 'POST',
    headers: {
      'X-Auth-Token': env.DOCUSEAL_API_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.log('DocuSeal error', res.status, detail);
    return json({ error: 'Could not prepare the application for signing. Please try again or use the PDF.' }, 502);
  }

  const submitters = await res.json();
  const slug = Array.isArray(submitters) && submitters[0] && submitters[0].slug;
  if (!slug) {
    return json({ error: 'Unexpected response from the signing service.' }, 502);
  }

  return json({ sign_url: `${env.DOCUSEAL_URL}/s/${slug}` });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
