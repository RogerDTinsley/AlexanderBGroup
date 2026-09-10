const appState = {
  benefitsXml: '',
  membershipXml: '',
  users: [],
  currentUser: null,
  currentView: 'public'
};

const storageKey = 'alexanderBGroup.membership';
const userKey = 'alexanderBGroup.users';

const elements = {
  benefitsList: document.getElementById('benefitsList'),
  contactInfo: document.getElementById('contactInfo'),
  loginForm: document.getElementById('loginForm'),
  signupForm: document.getElementById('signupForm'),
  sessionStatus: document.getElementById('sessionStatus'),
  dashboardTitle: document.getElementById('dashboardTitle'),
  memberEvents: document.getElementById('memberEvents'),
  rosterList: document.getElementById('rosterList'),
  roleManagement: document.getElementById('roleManagement'),
  adminPanel: document.getElementById('adminPanel'),
  maintainerPanel: document.getElementById('maintainerPanel'),
  securityPanel: document.getElementById('securityPanel'),
  benefitsEditor: document.getElementById('benefitsEditor'),
  membershipEditor: document.getElementById('membershipEditor'),
  securityEditor: document.getElementById('securityEditor'),
  saveXmlDataBtn: document.getElementById('saveXmlDataBtn'),
  saveSecurityBtn: document.getElementById('saveSecurityBtn'),
  downloadXmlBtn: document.getElementById('downloadXmlBtn'),
  toast: document.getElementById('toast'),
  logoutBtn: document.getElementById('logoutBtn'),
  openLoginBtn: document.getElementById('openLoginBtn'),
  xmlEditToggleBtn: document.getElementById('xmlEditToggleBtn'),
  personLookup: document.getElementById('personLookup'),
  personResults: document.getElementById('personResults'),
  familyRoster: document.getElementById('familyRoster'),
  profileForm: document.getElementById('profileForm'),
  profileFirstName: document.getElementById('profileFirstName'),
  profileLastName: document.getElementById('profileLastName'),
  profileEmail: document.getElementById('profileEmail'),
  profilePhone: document.getElementById('profilePhone'),
  profileBirthday: document.getElementById('profileBirthday'),
  profileFamily: document.getElementById('profileFamily'),
  profileAddress: document.getElementById('profileAddress'),
  profileCity: document.getElementById('profileCity'),
  profilePicture: document.getElementById('profilePicture'),
  profilePhotoWrap: document.getElementById('profilePhotoWrap')
};

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  setTimeout(() => elements.toast.classList.remove('show'), 2600);
}

function setView(viewName) {
  appState.currentView = viewName;
  document.querySelectorAll('.view-panel').forEach((panel) => {
    panel.classList.toggle('active-view', panel.id === `${viewName}View`);
  });
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
  });
}

function normalizeRole(role) {
  return (role || '').trim().toLowerCase();
}

function normalizeBirthday(value) {
  if (!value) return '';
  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return raw;

  const [, month, day, year] = match;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getFamilyName(familyNode) {
  if (!familyNode) return 'Family';
  return familyNode.getAttribute('name') || Array.from(familyNode.childNodes)
    .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())?.textContent.trim() || 'Family';
}

function normalizeUsername(value) {
  return String(value || '').trim();
}

function matchesUsername(user, attemptedUsername) {
  const candidate = normalizeUsername(attemptedUsername).toLowerCase();
  if (!candidate) return false;

  const emailMatch = (user.email || '').toLowerCase() === candidate;
  const phoneMatch = (user.phone || '').replace(/\D/g, '') === candidate.replace(/\D/g, '');
  return emailMatch || phoneMatch;
}

function getRoleDisplay(role) {
  if (!role) return 'Guest';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function saveUsers() {
  localStorage.setItem(userKey, JSON.stringify(appState.users));
}

function readUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(userKey) || '[]');
    appState.users = Array.isArray(parsed)
      ? parsed.map((user) => ({
          ...user,
          birthday: normalizeBirthday(user.birthday)
        }))
      : [];
  } catch (error) {
    appState.users = [];
  }
}

function hydrateUsersFromXml() {
  const parser = new DOMParser();
  const doc = parser.parseFromString(appState.membershipXml, 'application/xml');
  const xmlMembers = Array.from(doc.querySelectorAll('member'));

  if (!xmlMembers.length) return;

  const xmlMap = xmlMembers.map((memberNode, index) => ({
    id: `xml-${index + 1}`,
    firstName: memberNode.querySelector('firstname')?.textContent?.trim() || '',
    lastName: memberNode.querySelector('lastname')?.textContent?.trim() || '',
    email: memberNode.querySelector('email')?.textContent?.trim() || '',
    phone: memberNode.querySelector('phone')?.textContent?.trim() || '',
    birthday: memberNode.querySelector('birthday')?.textContent?.trim() || '',
    role: memberNode.querySelector('role')?.textContent?.trim() || 'Interested',
    family: getFamilyName(memberNode.closest('family')),
    address: memberNode.parentElement?.querySelector('Address')?.textContent?.trim() || '',
    city: memberNode.parentElement?.querySelector('City')?.textContent?.trim() || ''
  }));

  appState.users = appState.users.map((user) => {
    const match = xmlMap.find((member) => {
      const sameEmail = user.email && member.email && user.email.toLowerCase() === member.email.toLowerCase();
      const samePhone = user.phone && member.phone && user.phone.replace(/\D/g, '') === member.phone.replace(/\D/g, '');
      return sameEmail || samePhone;
    });

    if (!match) return user;

    return {
      ...user,
      firstName: user.firstName || match.firstName,
      lastName: user.lastName || match.lastName,
      email: user.email || match.email,
      phone: user.phone || match.phone,
      birthday: normalizeBirthday(user.birthday || match.birthday),
      role: user.role || match.role,
      family: match.family,
      address: user.address || match.address,
      city: user.city || match.city
    };
  });

  saveUsers();
}

function readXmlMembership() {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    appState.membershipXml = saved;
  }
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildXmlFromUsers() {
  const members = appState.users.map((person) => {
    const familyName = person.family || 'Family';
    return `  <family name="${escapeXml(familyName)}">\n    <Address>${escapeXml(person.address || '')}</Address>\n    <City>${escapeXml(person.city || '')}</City>\n    <member>\n      <firstname>${escapeXml(person.firstName || '')}</firstname>\n      <lastname>${escapeXml(person.lastName || '')}</lastname>\n      <email>${escapeXml(person.email || '')}</email>\n      <phone>${escapeXml(person.phone || '')}</phone>\n      <birthday>${escapeXml(person.birthday || '')}</birthday>\n      <role>${escapeXml(person.role || 'Interested')}</role>\n    </member>\n  </family>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<Record name="Alexander B Group">\n<membership>\n${members}\n</membership>\n  <Security Roles>\n    <Role>Admin</Role>\n    <Role>Member</Role>\n    <Role>Maintainer</Role>\n    <Role>Interested</Role>\n    <Role>Guest</Role>\n  </Security Roles>\n</Record>`;
}

function updateMembershipXmlFromUsers() {
  appState.membershipXml = buildXmlFromUsers();
  localStorage.setItem(storageKey, appState.membershipXml);
  if (elements.membershipEditor) elements.membershipEditor.value = appState.membershipXml;
}

function seedUsersFromXml() {
  readUsers();
  hydrateUsersFromXml();
  if (appState.users.length > 0) {
    return;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(appState.membershipXml, 'application/xml');
  const members = Array.from(doc.querySelectorAll('member'));

  appState.users = members.map((member, index) => ({
    id: `seed-${index + 1}`,
    firstName: member.querySelector('firstname')?.textContent?.trim() || `Member${index + 1}`,
    lastName: member.querySelector('lastname')?.textContent?.trim() || 'User',
    email: member.querySelector('email')?.textContent?.trim() || `member${index + 1}@example.com`,
    phone: member.querySelector('phone')?.textContent?.trim() || '',
    birthday: normalizeBirthday(member.querySelector('birthday')?.textContent?.trim() || ''),
    role: member.querySelector('role')?.textContent?.trim() || 'Interested',
    family: getFamilyName(member.closest('family')),
    address: member.closest('family')?.querySelector('Address')?.textContent?.trim() || '',
    city: member.closest('family')?.querySelector('City')?.textContent?.trim() || '',
    password: 'password123',
    picture: ''
  }));

  if (appState.users.length === 0) {
    appState.users = [{
      id: 'admin-1',
      firstName: 'Roger',
      lastName: 'Tinsley',
      email: 'rogerdtinsley@gmail.com',
      phone: '318-564-4382',
      birthday: '1945-12-02',
      role: 'Admin',
      family: 'Tinsley',
      address: '528 Buckhead Circle',
      city: 'Shreveport',
      password: 'admin123',
      picture: ''
    }];
  }

  saveUsers();
  updateMembershipXmlFromUsers();
}

async function loadXmlFiles() {
  try {
    const [benefitsResponse, membershipResponse] = await Promise.all([
      fetch('Benefits.xml', { cache: 'no-store' }),
      fetch('membership.xml', { cache: 'no-store' })
    ]);

    if (!benefitsResponse.ok || !membershipResponse.ok) {
      throw new Error('Failed to fetch XML files.');
    }

    appState.benefitsXml = await benefitsResponse.text();
    appState.membershipXml = await membershipResponse.text();
    localStorage.setItem(storageKey, appState.membershipXml);
    localStorage.setItem('alexanderBGroup.benefits', appState.benefitsXml);
  } catch (error) {
    console.warn('Using saved local data.', error);
    readXmlMembership();
    appState.benefitsXml = localStorage.getItem('alexanderBGroup.benefits') || '<?xml version="1.0" encoding="UTF-8"?><Record name="Alexander B Group"><Description>Community outreach and ministry.</Description><Activities></Activities><events></events></Record>';
    if (!appState.membershipXml) {
      appState.membershipXml = '<?xml version="1.0" encoding="UTF-8"?><Record name="Alexander B Group"><membership></membership><Security Roles></Security Roles></Record>';
    }
  }

  hydrateUsersFromXml();
  seedUsersFromXml();
  renderAll();
}

function parseBenefitsXml(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const activities = Array.from(xml.querySelectorAll('Activity')).map((item) => ({
    name: item.getAttribute('name') || item.textContent.trim(),
    description: item.textContent.trim()
  })).filter((item) => item.name && item.description);
  const events = Array.from(xml.querySelectorAll('event')).map((item) => ({
    title: item.textContent.trim() || item.getAttribute('location'),
    date: item.getAttribute('date'),
    time: item.getAttribute('time'),
    location: item.getAttribute('location')
  }));
  const contact = {
    name: xml.querySelector('Record')?.getAttribute('name') || 'Alexander B Group',
    description: xml.querySelector('Description')?.textContent?.trim() || 'Community outreach and ministry.'
  };

  return { activities, events, contact };
}

function renderPublic() {
  const { activities, contact } = parseBenefitsXml(appState.benefitsXml);

  elements.benefitsList.innerHTML = activities.length
    ? activities.map((activity) => `
        <div class="benefit-item">
          <strong>${activity.name}</strong>
          <div>${activity.description}</div>
        </div>
      `).join('')
    : '<div class="benefit-item"><strong>No activities listed yet.</strong></div>';

  elements.contactInfo.innerHTML = `
    <div class="contact-item">
      <strong>${contact.name}</strong>
      <div>${contact.description}</div>
      <div>We welcome visitors who are interested in learning more about our class.</div>
      <div>Interested in joining? Create an account from the login section.</div>
    </div>
  `;
}

function getEventsHtml() {
  const { events } = parseBenefitsXml(appState.benefitsXml);
  const rows = events.length
    ? events.map((event) => `
        <tr>
          <td>${event.title}</td>
          <td>${event.date || 'Date TBD'}</td>
          <td>${event.time || 'Time TBD'}</td>
          <td>${event.location || 'Location TBD'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4">No events currently scheduled.</td></tr>';

  return `
    <div class="events-table-wrap">
      <table class="events-table">
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Date</th>
            <th scope="col">Time</th>
            <th scope="col">Location</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderRoster() {
  const roster = [...appState.users].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));

  elements.rosterList.innerHTML = roster.map((member) => `
    <div class="roster-item">
      <strong>${member.firstName} ${member.lastName}</strong>
      <div>${member.email}</div>
      <div>Role: ${member.role || 'Interested'}</div>
    </div>
  `).join('');

  elements.roleManagement.innerHTML = roster.map((member) => `
    <div class="notification-item">
      <strong>${member.firstName} ${member.lastName}</strong>
      <div>${member.email}</div>
      <label>
        Role
        <select data-user-id="${member.id}" class="role-selector">
          ${['Admin', 'Maintainer', 'Member', 'Interested', 'Guest'].map((role) => `
            <option value="${role}" ${member.role === role ? 'selected' : ''}>${role}</option>
          `).join('')}
        </select>
      </label>
    </div>
  `).join('');

  document.querySelectorAll('.role-selector').forEach((select) => {
    select.addEventListener('change', (event) => {
      const userId = event.target.dataset.userId;
      const targetUser = appState.users.find((member) => member.id === userId);
      if (!targetUser) return;
      const newRole = event.target.value;

      if (appState.currentUser?.role !== 'Admin') {
        showToast('Only the admin can assign roles of admin or maintainer.');
        event.target.value = targetUser.role || 'Interested';
        return;
      }

      if ((newRole === 'Admin' || newRole === 'Maintainer') && appState.currentUser.id !== targetUser.id) {
        showToast('Only the admin role can assign admin or maintainer permissions.');
        event.target.value = targetUser.role || 'Interested';
        return;
      }

      targetUser.role = newRole;
      saveUsers();
      updateMembershipXmlFromUsers();
      renderDashboard();
      showToast(`Updated ${targetUser.firstName} ${targetUser.lastName} to ${newRole}.`);
    });
  });
}

function renderLookup() {
  const query = elements.personLookup.value.trim().toLowerCase();
  const filtered = !query
    ? appState.users
    : appState.users.filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        return fullName.includes(query) || user.email.toLowerCase().includes(query);
      });

  elements.personResults.innerHTML = filtered.length
    ? filtered.map((member) => `
        <div class="roster-item">
          <strong>${member.firstName} ${member.lastName}</strong>
          <div>${member.email}</div>
          <div>${member.role}</div>
        </div>
      `).join('')
    : '<div class="roster-item"><strong>No matches found.</strong></div>';
}

function renderFamilyRoster() {
  if (!appState.currentUser) {
    elements.familyRoster.innerHTML = '<div class="roster-item"><strong>No family.</strong></div>';
    return;
  }

  const sameFamily = appState.users.filter((member) => member.family === appState.currentUser.family);
  elements.familyRoster.innerHTML = sameFamily.length
    ? sameFamily.map((member) => `
        <div class="roster-item">
          <strong>${member.firstName} ${member.lastName}</strong>
          <div>${member.email}</div>
          <div>${member.role}</div>
        </div>
      `).join('')
    : '<div class="roster-item"><strong>No family members found.</strong></div>';
}

function renderProfileForm() {
  if (!appState.currentUser) return;
  const user = appState.currentUser;

  elements.profileFirstName.value = user.firstName || '';
  elements.profileLastName.value = user.lastName || '';
  elements.profileEmail.value = user.email || '';
  elements.profilePhone.value = user.phone || '';
  elements.profileBirthday.value = normalizeBirthday(user.birthday || '');
  elements.profileFamily.value = user.family || '';
  elements.profileAddress.value = user.address || '';
  elements.profileCity.value = user.city || '';

  elements.profilePhotoWrap.innerHTML = user.picture
    ? `<img src="${user.picture}" alt="Profile photo" class="profile-photo" />`
    : '<div class="placeholder-photo">No picture</div>';
}

function renderDashboard() {
  const currentUser = appState.currentUser;
  if (!currentUser) {
    elements.sessionStatus.textContent = 'Guest mode';
    return;
  }

  elements.dashboardTitle.textContent = `Welcome, ${currentUser.firstName} ${currentUser.lastName}`;
  elements.sessionStatus.textContent = 'Signed in';
  document.body.classList.add('logged-in');

  elements.memberEvents.innerHTML = getEventsHtml();
  elements.personLookup.value = '';
  renderLookup();
  renderFamilyRoster();
  renderRoster();
  renderProfileForm();

  const role = normalizeRole(currentUser.role || 'guest');
  const canEditXml = role === 'admin' || role === 'maintainer';
  const canEditRoles = role === 'admin';

  elements.xmlEditToggleBtn.classList.toggle('hidden-section', !canEditXml);
  elements.adminPanel.classList.toggle('visible-section', canEditRoles);
  elements.adminPanel.classList.toggle('hidden-section', !canEditRoles);

  elements.maintainerPanel.classList.toggle('visible-section', canEditXml);
  elements.maintainerPanel.classList.toggle('hidden-section', !canEditXml);

  elements.securityPanel.classList.toggle('visible-section', canEditRoles);
  elements.securityPanel.classList.toggle('hidden-section', !canEditRoles);

  elements.membershipEditor.value = appState.membershipXml;
  elements.benefitsEditor.value = appState.benefitsXml;
  elements.securityEditor.value = localStorage.getItem('alexanderBGroup.security') || '<?xml version="1.0" encoding="UTF-8"?><Record name="Alexander B Group"><Security Roles><Role>Admin</Role><Role>Maintainer</Role><Role>Member</Role><Role>Interested</Role><Role>Guest</Role></Security Roles></Record>';

  if (role === 'guest' || role === 'interested') {
    setView('public');
    showToast('Guest and Interested users stay on the public page.');
  } else {
    setView('dashboard');
  }
}

function loginUser(email, password) {
  const candidate = normalizeUsername(email);
  const user = appState.users.find((member) => matchesUsername(member, candidate));

  if (!user) {
    showToast('Login failed. Check your email or phone number.');
    return false;
  }

  appState.currentUser = user;
  sessionStorage.setItem('alexanderBGroup.currentUser', JSON.stringify(user));
  renderDashboard();
  if (normalizeRole(user.role) === 'guest' || normalizeRole(user.role) === 'interested') {
    setView('public');
  } else {
    setView('dashboard');
  }
  showToast(`Welcome back, ${user.firstName}.`);
  return true;
}

function logoutUser() {
  appState.currentUser = null;
  sessionStorage.removeItem('alexanderBGroup.currentUser');
  document.body.classList.remove('logged-in');
  elements.sessionStatus.textContent = 'Guest mode';
  setView('public');
  showToast('You have been logged out.');
}

function createAccount(formValues) {
  const email = formValues.email.trim().toLowerCase();
  const exists = appState.users.some((member) => member.email.toLowerCase() === email);

  if (exists) {
    showToast('An account already exists for that email. Please log in.');
    return;
  }

  const newMember = {
    id: `user-${Date.now()}`,
    firstName: formValues.firstName.trim(),
    lastName: formValues.lastName.trim(),
    email,
    phone: formValues.phone.trim(),
    birthday: normalizeBirthday(formValues.birthday),
    role: 'Interested',
    family: formValues.family || 'New Family',
    address: '',
    city: '',
    password: formValues.password,
    picture: formValues.picture || ''
  };

  appState.users.push(newMember);
  saveUsers();
  updateMembershipXmlFromUsers();
  appState.currentUser = newMember;
  sessionStorage.setItem('alexanderBGroup.currentUser', JSON.stringify(newMember));
  renderDashboard();
  setView('dashboard');
  showToast('Account created. Maintainers have been notified to review your request.');
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  loginUser(email, password);
  event.target.reset();
}

function handleSignupSubmit(event) {
  event.preventDefault();
  const pictureInput = document.getElementById('signupPicture');

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read the selected picture.'));
    reader.readAsDataURL(file);
  });

  readFileAsDataUrl(pictureInput.files[0])
    .then((pictureData) => {
      createAccount({
        firstName: document.getElementById('signupFirstName').value,
        lastName: document.getElementById('signupLastName').value,
        email: document.getElementById('signupEmail').value,
        phone: document.getElementById('signupPhone').value,
        birthday: document.getElementById('signupBirthday').value,
        family: document.getElementById('signupFamily').value,
        password: document.getElementById('signupPassword').value,
        picture: pictureData
      });
      event.target.reset();
    })
    .catch((error) => {
      showToast(error.message || 'There was an issue creating your account.');
    });
}

function handleProfileSave(event) {
  event.preventDefault();
  if (!appState.currentUser) return;

  const role = normalizeRole(appState.currentUser.role || 'guest');
  const isOwnProfile = true;

  if (role === 'guest' || role === 'interested') {
    showToast('Please become a member or maintainer to edit your profile.');
    return;
  }

  const files = elements.profilePicture.files;
  const readFileAsDataUrl = (file) => new Promise((resolve) => {
    if (!file) {
      resolve(appState.currentUser.picture || '');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(appState.currentUser.picture || '');
    reader.readAsDataURL(file);
  });

  readFileAsDataUrl(files[0]).then((pictureData) => {
    const updatedUser = {
      ...appState.currentUser,
      firstName: elements.profileFirstName.value.trim(),
      lastName: elements.profileLastName.value.trim(),
      email: elements.profileEmail.value.trim(),
      phone: elements.profilePhone.value.trim(),
      birthday: normalizeBirthday(elements.profileBirthday.value),
      family: elements.profileFamily.value.trim() || appState.currentUser.family,
      address: elements.profileAddress.value.trim(),
      city: elements.profileCity.value.trim(),
      picture: pictureData
    };

    appState.users = appState.users.map((member) => member.id === updatedUser.id ? updatedUser : member);
    appState.currentUser = updatedUser;
    saveUsers();
    updateMembershipXmlFromUsers();
    sessionStorage.setItem('alexanderBGroup.currentUser', JSON.stringify(updatedUser));
    renderDashboard();
    showToast('Your profile has been updated.');
  });
}

function handleXmlSave() {
  const role = normalizeRole(appState.currentUser?.role || 'guest');
  if (role !== 'maintainer' && role !== 'admin') {
    showToast('Only maintainers and admins may edit XML data.');
    return;
  }

  const benefitsText = elements.benefitsEditor.value.trim();
  const membershipText = elements.membershipEditor.value.trim();

  if (!benefitsText || !membershipText) {
    showToast('Both XML files must contain content before saving.');
    return;
  }

  appState.benefitsXml = benefitsText;
  appState.membershipXml = membershipText;
  localStorage.setItem('alexanderBGroup.benefits', appState.benefitsXml);
  localStorage.setItem(storageKey, appState.membershipXml);

  const parsedMembership = new DOMParser().parseFromString(appState.membershipXml, 'application/xml');
  const memberNodes = parsedMembership.querySelectorAll('member');
  appState.users = Array.from(memberNodes).map((memberNode, index) => ({
    id: `xml-${index + 1}`,
    firstName: memberNode.querySelector('firstname')?.textContent?.trim() || '',
    lastName: memberNode.querySelector('lastname')?.textContent?.trim() || '',
    email: memberNode.querySelector('email')?.textContent?.trim() || '',
    phone: memberNode.querySelector('phone')?.textContent?.trim() || '',
    birthday: memberNode.querySelector('birthday')?.textContent?.trim() || '',
    role: memberNode.querySelector('role')?.textContent?.trim() || 'Interested',
    family: getFamilyName(memberNode.closest('family')),
    address: memberNode.parentElement?.querySelector('Address')?.textContent?.trim() || '',
    city: memberNode.parentElement?.querySelector('City')?.textContent?.trim() || '',
    password: appState.users[index]?.password || 'password123',
    picture: appState.users[index]?.picture || ''
  }));

  saveUsers();
  renderAll();
  showToast('Local XML changes saved for this prototype.');
}

function handleSecuritySave() {
  if (normalizeRole(appState.currentUser?.role || 'guest') !== 'admin') {
    showToast('Only the admin can change Security.xml.');
    return;
  }

  const securityText = elements.securityEditor.value.trim();
  if (!securityText) {
    showToast('Security.xml cannot be empty.');
    return;
  }

  localStorage.setItem('alexanderBGroup.security', securityText);
  showToast('Security settings saved.');
}

function renderAll() {
  renderPublic();
  renderRoster();
  renderLookup();

  const storedUser = sessionStorage.getItem('alexanderBGroup.currentUser');
  if (storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser);
      appState.currentUser = {
        ...parsedUser,
        birthday: normalizeBirthday(parsedUser.birthday)
      };
      sessionStorage.setItem('alexanderBGroup.currentUser', JSON.stringify(appState.currentUser));
      renderDashboard();
      setView('dashboard');
      document.body.classList.add('logged-in');
    } catch (error) {
      logoutUser();
    }
  } else {
    document.body.classList.remove('logged-in');
    elements.sessionStatus.textContent = 'Guest mode';
    setView('public');
  }
}

function attachEvents() {
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const viewName = button.dataset.view;
      if (viewName === 'dashboard' && !appState.currentUser) {
        showToast('Please log in first.');
        setView('auth');
        return;
      }
      setView(viewName);
    });
  });

  elements.loginForm.addEventListener('submit', handleLoginSubmit);
  elements.signupForm.addEventListener('submit', handleSignupSubmit);
  elements.profileForm.addEventListener('submit', handleProfileSave);
  elements.personLookup.addEventListener('input', renderLookup);
  elements.logoutBtn.addEventListener('click', logoutUser);
  elements.saveXmlDataBtn.addEventListener('click', handleXmlSave);
  elements.saveSecurityBtn.addEventListener('click', handleSecuritySave);
  elements.xmlEditToggleBtn.addEventListener('click', () => {
    const role = normalizeRole(appState.currentUser?.role || 'guest');
    if (role === 'admin' || role === 'maintainer') {
      document.getElementById('maintainerPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  elements.openLoginBtn.addEventListener('click', () => setView('auth'));

  elements.downloadXmlBtn.addEventListener('click', () => {
    const blob = new Blob([appState.membershipXml], { type: 'application/xml' });
    const href = URL.createObjectURL(blob);
    elements.downloadXmlBtn.href = href;
    setTimeout(() => URL.revokeObjectURL(href), 3000);
  });
}

attachEvents();
loadXmlFiles();
