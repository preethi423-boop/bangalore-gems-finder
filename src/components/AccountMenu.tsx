import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserRound, ShieldCheck, KeyRound, CreditCard, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ApiKeyDialog } from "@/components/ApiKeyDialog";

export function AccountMenu({ signedIn, isAdmin, hasKey }: { signedIn: boolean; isAdmin: boolean; hasKey: boolean }) {
  const [keyOpen, setKeyOpen] = useState(false);
  return <><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon" className="shrink-0 rounded-full" aria-label="Account and settings" title="Account and settings"><UserRound className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
    <DropdownMenuItem asChild><Link to={signedIn ? "/subscription" : "/auth"} search={signedIn ? undefined : { returnTo: "/" }}><LogIn className="size-4" />{signedIn ? "My account" : "Sign in"}</Link></DropdownMenuItem>
    {signedIn && isAdmin ? <DropdownMenuItem asChild><Link to="/admin"><ShieldCheck className="size-4" />Admin dashboard</Link></DropdownMenuItem> : null}
    <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setKeyOpen(true)}><KeyRound className="size-4" />Google API key</DropdownMenuItem>
    <DropdownMenuItem asChild><Link to="/subscription"><CreditCard className="size-4" />Plans &amp; access</Link></DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu><ApiKeyDialog hasKey={hasKey} controlledOpen={keyOpen} onControlledOpenChange={setKeyOpen} /></>;
}