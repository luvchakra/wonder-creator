import { SUBPROCESSORS } from "./data";

export const metadata = { title: "Subprocessors" };

export default function SubprocessorsPage() {
  return (
    <article>
      <h1>Subprocessors</h1>
      <p>
        These companies process personal data for us, only to provide Wonder Creator and only under written terms that require them to protect it. Providers marked &ldquo;when connected&rdquo; receive nothing
        unless that feature is switched on for the service, and AI providers receive only what you choose to work on — never to train their models.
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">Provider</th>
              <th scope="col">What for</th>
              <th scope="col">Data</th>
              <th scope="col">Where</th>
            </tr>
          </thead>
          <tbody className="text-[14px]">
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name}>
                <td className="font-medium">{s.name}</td>
                <td>{s.purpose}</td>
                <td>{s.data}</td>
                <td>{s.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>We update this page before adding a new subprocessor. Transfers outside your country rely on adequacy decisions or Standard Contractual Clauses (GDPR), and are made only to countries not restricted under India&rsquo;s DPDP Act.</p>
    </article>
  );
}
